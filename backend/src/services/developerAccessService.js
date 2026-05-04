const userRepository = require("../repositories/userRepository");
const { hashPassword, comparePassword } = require("../utils/password");
const { query } = require("../config/db");
const env = require("../config/env");

const ensureDeveloperAccount = async () => {
  const config = env.developerPortal;
  if (!config.enabled) {
    return null;
  }

  const email = String(config.email || "").trim().toLowerCase();
  const password = String(config.password || "").trim();
  const fullName = String(config.fullName || "Developer Console").trim();

  if (!email || !password) {
    return null;
  }

  const existing = await userRepository.findByEmail(email);

  if (!existing) {
    const created = await userRepository.create({
      fullName,
      email,
      passwordHash: await hashPassword(password),
      platformRole: "platform_admin",
      companyId: null,
      companyRole: null,
      managerId: null,
      avatarUrl: null,
    });

    await query(
      `
        UPDATE users
        SET platform_role = 'platform_admin'::platform_role_enum,
            company_role = NULL,
            company_id = NULL,
            manager_id = NULL,
            is_active = TRUE,
            updated_at = NOW()
        WHERE id = $1
      `,
      [created.id]
    );

    console.log(`Developer portal account created for ${email}`);
    return created;
  }

  let shouldRotatePassword = true;
  if (typeof existing.password_hash === "string" && existing.password_hash) {
    try {
      shouldRotatePassword = !(await comparePassword(password, existing.password_hash));
    } catch (_error) {
      shouldRotatePassword = true;
    }
  }

  await query(
    `
      UPDATE users
      SET full_name = $2,
          platform_role = 'platform_admin'::platform_role_enum,
          company_role = NULL,
          company_id = NULL,
          manager_id = NULL,
          is_active = TRUE,
          password_hash = CASE WHEN $3::boolean THEN $4::text ELSE password_hash END,
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      existing.id,
      fullName,
      shouldRotatePassword,
      shouldRotatePassword ? await hashPassword(password) : null,
    ]
  );

  return existing;
};

module.exports = {
  ensureDeveloperAccount,
};
