## Database Design

### Core entities

- `users`: system accounts for admins, managers, and sales reps
- `leads`: prospects before conversion
- `customers`: converted accounts with lifecycle and revenue data
- `deals`: pipeline opportunities tied to either a lead or customer
- `activities`: calls, emails, meetings, notes, and tasks
- `notifications`: reminders and in-app alerts

### Relationships

- `leads.assigned_to -> users.id`
- `leads.created_by -> users.id`
- `customers.lead_id -> leads.id`
- `customers.owner_id -> users.id`
- `deals.customer_id -> customers.id`
- `deals.lead_id -> leads.id`
- `deals.owner_id -> users.id`
- `activities.user_id -> users.id`
- `activities.related_lead_id -> leads.id`
- `activities.related_customer_id -> customers.id`
- `activities.related_deal_id -> deals.id`
- `notifications.user_id -> users.id`

### Normalization notes

- User profile data is stored once in `users`
- Lead and customer data are separated to preserve pre-conversion workflow history
- Deals reference entities instead of duplicating account or rep fields
- Activities are polymorphic through nullable foreign keys to avoid duplicating timeline tables
- Notifications are isolated from activities so reminder delivery and read state stay independent

### Constraints and indexing

- Enum types enforce role, status, stage, and activity validity
- `email` is `CITEXT` for case-insensitive uniqueness
- Revenue, deal value, score, and probability use `CHECK` constraints
- Composite and targeted indexes support common filters:
- lead status and assignee
- deal owner and stage
- customer owner
- due reminders
- analytics date rollups
- GIN search index on lead text fields

### Files

- Schema: [001_init_crm_schema.sql](/Users/param/Desktop/CRM%20Project/backend/src/db/migrations/001_init_crm_schema.sql)
- Seed data: [002_seed_dev_data.sql](/Users/param/Desktop/CRM%20Project/backend/src/db/migrations/002_seed_dev_data.sql)

### Seed login

- Development seed password: `Password123!`
- Admin: `admin@crm.local`
- Manager: `manager@crm.local`
- Sales rep: `sales@crm.local`
