const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");

const CSV_PATH = "/Users/param/Downloads/Auto Sales data.csv";
const IMPORT_EMAIL = "autosales@crm.local";
const IMPORT_PASSWORD = "Password123!";
const IMPORT_NAME = "Auto Sales Portfolio";
const IMPORT_ROLE = "manager";

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
};

const parseCsv = (content) => {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const parseNumber = (value) => Number(String(value || "0").replace(/,/g, "")) || 0;

const parseDate = (value) => {
  const [day, month, year] = String(value || "").split("/");
  if (!day || !month || !year) return null;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
};

const toSqlTimestamp = (date) =>
  date ? date.toISOString().replace("T", " ").replace("Z", "") : null;

const toSqlDate = (date) => (date ? date.toISOString().slice(0, 10) : null);

const mapDealOutcome = (status) => {
  switch (status) {
    case "Shipped":
    case "Resolved":
      return { stage: "won", status: "won", probability: 100 };
    case "Cancelled":
    case "Disputed":
      return { stage: "lost", status: "lost", probability: 0 };
    case "On Hold":
      return { stage: "negotiation", status: "open", probability: 65 };
    case "In Process":
      return { stage: "proposal", status: "open", probability: 45 };
    default:
      return { stage: "discovery", status: "open", probability: 30 };
  }
};

const mapLeadStatus = (status) => {
  switch (status) {
    case "In Process":
      return "contacted";
    case "On Hold":
      return "qualified";
    case "Cancelled":
    case "Disputed":
      return "lost";
    default:
      return "new";
  }
};

const leadRank = (status) => {
  switch (status) {
    case "qualified":
      return 4;
    case "contacted":
      return 3;
    case "new":
      return 2;
    case "lost":
      return 1;
    default:
      return 0;
  }
};

const mapLifecycle = (customer) => {
  if (customer.totalRevenue >= 90000) return "vip";
  if (customer.daysSinceLastOrder >= 800) return "at_risk";
  return "active";
};

const groupSampleData = (rows) => {
  const customers = new Map();
  const orders = new Map();
  const leadCandidates = new Map();

  rows.forEach((row) => {
    const customerName = row.CUSTOMERNAME;
    const fullName = `${row.CONTACTFIRSTNAME} ${row.CONTACTLASTNAME}`.trim();
    const sales = parseNumber(row.SALES);
    const quantity = parseNumber(row.QUANTITYORDERED);
    const orderDate = parseDate(row.ORDERDATE);
    const daysSinceLastOrder = parseNumber(row.DAYS_SINCE_LASTORDER);

    if (!customers.has(customerName)) {
      customers.set(customerName, {
        contactName: fullName,
        email: `${slugify(customerName)}@autosales.local`,
        phone: row.PHONE || null,
        company: customerName,
        industry: row.PRODUCTLINE || "Automotive",
        address: [row.ADDRESSLINE1, row.CITY, row.POSTALCODE, row.COUNTRY]
          .filter(Boolean)
          .join(", "),
        totalRevenue: 0,
        orderCount: 0,
        daysSinceLastOrder,
        latestOrderDate: orderDate,
        productLines: new Set(),
      });
    }

    const customer = customers.get(customerName);
    customer.totalRevenue += sales;
    customer.orderCount += 1;
    customer.daysSinceLastOrder = Math.min(customer.daysSinceLastOrder, daysSinceLastOrder || customer.daysSinceLastOrder);
    customer.latestOrderDate =
      !customer.latestOrderDate || (orderDate && orderDate > customer.latestOrderDate)
        ? orderDate
        : customer.latestOrderDate;
    if (row.PRODUCTLINE) customer.productLines.add(row.PRODUCTLINE);

    const orderKey = `${row.ORDERNUMBER}`;
    if (!orders.has(orderKey)) {
      orders.set(orderKey, {
        orderNumber: row.ORDERNUMBER,
        customerName,
        status: row.STATUS,
        value: 0,
        quantity: 0,
        orderDate,
        productLines: new Set(),
        lines: [],
        daysSinceLastOrder,
      });
    }

    const order = orders.get(orderKey);
    order.value += sales;
    order.quantity += quantity;
    order.status = row.STATUS;
    order.orderDate = orderDate || order.orderDate;
    order.daysSinceLastOrder = daysSinceLastOrder || order.daysSinceLastOrder;
    if (row.PRODUCTLINE) order.productLines.add(row.PRODUCTLINE);
    order.lines.push({
      productCode: row.PRODUCTCODE,
      productLine: row.PRODUCTLINE,
      quantity,
      priceEach: parseNumber(row.PRICEEACH),
    });

    if (["Cancelled", "Disputed", "On Hold", "In Process"].includes(row.STATUS)) {
      const key = customerName;
      if (!leadCandidates.has(key)) {
        leadCandidates.set(key, {
          name: fullName,
          email: `${slugify(customerName)}-lead@autosales.local`,
          phone: row.PHONE || null,
          company: customerName,
          source: "auto-sales-import",
          status: mapLeadStatus(row.STATUS),
          estimatedValue: 0,
          score: row.STATUS === "On Hold" ? 78 : row.STATUS === "In Process" ? 64 : 28,
          notes: `Imported from Auto Sales sample data. Latest status: ${row.STATUS}. Product line: ${row.PRODUCTLINE}.`,
          lastContactedAt: orderDate,
        });
      }
      const lead = leadCandidates.get(key);
      lead.estimatedValue += sales;
      if (leadRank(mapLeadStatus(row.STATUS)) > leadRank(lead.status)) {
        lead.status = mapLeadStatus(row.STATUS);
      }
      if (parseNumber(row.DAYS_SINCE_LASTORDER) > 700 && lead.status !== "qualified") {
        lead.status = "new";
      }
      if (orderDate && (!lead.lastContactedAt || orderDate > lead.lastContactedAt)) {
        lead.lastContactedAt = orderDate;
      }
    }
  });

  const normalizedCustomers = [...customers.values()].map((customer) => ({
    ...customer,
    lifecycleStage: mapLifecycle(customer),
    notes: `Imported from Auto Sales sample. ${customer.orderCount} orders, product lines: ${[
      ...customer.productLines,
    ].join(", ")}. Address: ${customer.address}.`,
  }));

  const normalizedOrders = [...orders.values()].map((order) => ({
    ...order,
    productLines: [...order.productLines],
    outcome: mapDealOutcome(order.status),
  }));

  const normalizedLeads = [...leadCandidates.values()]
    .sort((a, b) => b.estimatedValue - a.estimatedValue)
    .slice(0, 20);

  return {
    customers: normalizedCustomers,
    orders: normalizedOrders,
    leads: normalizedLeads,
  };
};

const runImport = async () => {
  const content = fs.readFileSync(path.resolve(CSV_PATH), "utf8");
  const rows = parseCsv(content);
  const transformed = groupSampleData(rows);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(IMPORT_PASSWORD, 10);
    const userResult = await client.query(
      `
        INSERT INTO users (full_name, email, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (email)
        DO UPDATE SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_active = TRUE
        RETURNING id
      `,
      [IMPORT_NAME, IMPORT_EMAIL, passwordHash, IMPORT_ROLE]
    );

    const ownerId = userResult.rows[0].id;

    await client.query("TRUNCATE notifications, activities, deals, customers, leads RESTART IDENTITY CASCADE");

    const customerIdByCompany = new Map();

    for (const customer of transformed.customers) {
      const inserted = await client.query(
        `
          INSERT INTO customers (
            name, email, phone, company, industry, owner_id, lifecycle_stage, total_revenue, notes
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING id
        `,
        [
          customer.contactName,
          customer.email,
          customer.phone,
          customer.company,
          customer.industry,
          ownerId,
          customer.lifecycleStage,
          customer.totalRevenue,
          customer.notes,
        ]
      );
      customerIdByCompany.set(customer.company, inserted.rows[0].id);
    }

    for (const lead of transformed.leads) {
      await client.query(
        `
          INSERT INTO leads (
            name, email, phone, company, source, status, score, estimated_value,
            notes, assigned_to, created_by, last_contacted_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `,
        [
          lead.name,
          lead.email,
          lead.phone,
          lead.company,
          lead.source,
          lead.status,
          lead.score,
          lead.estimatedValue,
          lead.notes,
          ownerId,
          ownerId,
          toSqlTimestamp(lead.lastContactedAt),
        ]
      );
    }

    for (const order of transformed.orders) {
      const customerId = customerIdByCompany.get(order.customerName);
      const insertedDeal = await client.query(
        `
          INSERT INTO deals (
            title, customer_id, owner_id, stage, status, value, probability, expected_close_date
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING id
        `,
        [
          `Order #${order.orderNumber} - ${order.customerName}`,
          customerId,
          ownerId,
          order.outcome.stage,
          order.outcome.status,
          order.value,
          order.outcome.probability,
          toSqlDate(order.orderDate),
        ]
      );

      await client.query(
        `
          INSERT INTO activities (
            type, subject, notes, related_customer_id, related_deal_id, user_id, due_at, completed_at, created_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          "note",
          `Imported order activity #${order.orderNumber}`,
          `Status: ${order.status}. Product lines: ${order.productLines.join(", ")}. Quantity: ${order.quantity}.`,
          customerId,
          insertedDeal.rows[0].id,
          ownerId,
          order.outcome.status === "open" ? toSqlTimestamp(order.orderDate) : null,
          order.outcome.status !== "open" ? toSqlTimestamp(order.orderDate) : null,
          toSqlTimestamp(order.orderDate),
        ]
      );
    }

    const topFollowUps = transformed.orders
      .filter((order) => order.outcome.status === "open")
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    for (const followUp of topFollowUps) {
      await client.query(
        `
          INSERT INTO notifications (user_id, type, title, message, remind_at, metadata)
          VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          ownerId,
          "reminder",
          `Follow up on order #${followUp.orderNumber}`,
          `${followUp.customerName} has an open ${followUp.status} order worth ${followUp.value.toFixed(2)}.`,
          new Date(Date.now() + 86400000).toISOString(),
          JSON.stringify({
            orderNumber: followUp.orderNumber,
            customerName: followUp.customerName,
          }),
        ]
      );
    }

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          importedUser: {
            email: IMPORT_EMAIL,
            password: IMPORT_PASSWORD,
            role: IMPORT_ROLE,
          },
          customers: transformed.customers.length,
          deals: transformed.orders.length,
          leads: transformed.leads.length,
          notifications: topFollowUps.length,
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

runImport().catch((error) => {
  console.error(error);
  process.exit(1);
});
