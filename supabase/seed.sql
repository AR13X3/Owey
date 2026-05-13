-- ============================================================
-- SplitMate Seed Data (development only)
-- NOTE: Run schema.sql first, then create two real users via
-- the app's register flow. These are placeholder UUIDs — replace
-- with real user IDs from auth.users after registration.
-- ============================================================

-- To use this seed:
-- 1. Register two users via the app
-- 2. Get their IDs from Supabase Auth > Users
-- 3. Replace USER1_ID and USER2_ID below
-- 4. Run this SQL

DO $$
DECLARE
  v_user1 uuid := 'REPLACE_WITH_USER1_ID';
  v_user2 uuid := 'REPLACE_WITH_USER2_ID';
  v_household uuid;
  v_receipt1 uuid;
  v_receipt2 uuid;
BEGIN
  -- Create household
  INSERT INTO households (name, user1_id, user2_id, invite_code)
  VALUES ('Dev Household', v_user1, v_user2, 'devtest1')
  RETURNING id INTO v_household;

  -- Link profiles
  UPDATE profiles SET household_id = v_household WHERE id IN (v_user1, v_user2);

  -- Receipt 1: Woolworths
  INSERT INTO receipts (id, household_id, uploaded_by, store_name, receipt_date, total_amount, split_mode)
  VALUES (gen_random_uuid(), v_household, v_user1, 'Woolworths Auburn', '2026-05-10', 47.85, 'half')
  RETURNING id INTO v_receipt1;

  INSERT INTO receipt_items (receipt_id, name, quantity, unit_price, assigned_to) VALUES
    (v_receipt1, 'WW Full Cream Milk 2L', 2, 2.20, 'shared'),
    (v_receipt1, 'Chicken Breast 500g', 1, 8.50, 'shared'),
    (v_receipt1, 'Sourdough Bread', 1, 4.50, 'user1'),
    (v_receipt1, 'Greek Yoghurt 1kg', 1, 6.00, 'shared'),
    (v_receipt1, 'Cherry Tomatoes 250g', 1, 3.50, 'shared'),
    (v_receipt1, 'Cheddar Cheese 500g', 1, 7.00, 'shared'),
    (v_receipt1, 'Pasta 500g', 2, 2.00, 'shared'),
    (v_receipt1, 'Woolworths Paper Bag', 2, 0.25, 'shared');

  -- Receipt 2: Coles
  INSERT INTO receipts (id, household_id, uploaded_by, store_name, receipt_date, total_amount, split_mode)
  VALUES (gen_random_uuid(), v_household, v_user2, 'Coles Parramatta', '2026-05-08', 62.40, 'per_item')
  RETURNING id INTO v_receipt2;

  INSERT INTO receipt_items (receipt_id, name, quantity, unit_price, assigned_to) VALUES
    (v_receipt2, 'Atlantic Salmon 400g', 1, 14.00, 'shared'),
    (v_receipt2, 'Coles Sparkling Water 1.25L', 4, 1.50, 'shared'),
    (v_receipt2, 'Avocados', 3, 2.00, 'user2'),
    (v_receipt2, 'Baby Spinach 150g', 1, 3.50, 'shared'),
    (v_receipt2, 'Laundry Powder 2kg', 1, 12.00, 'shared'),
    (v_receipt2, 'Dishwashing Liquid', 1, 4.50, 'shared'),
    (v_receipt2, 'Oat Milk 1L', 2, 4.00, 'user1');

  -- Expenses
  INSERT INTO expenses (household_id, paid_by, expense_type, category, amount, description, expense_date, split_with) VALUES
    (v_household, v_user1, 'shared', 'utilities', 120.00, 'Electricity Bill', '2026-05-01', v_user2),
    (v_household, v_user2, 'shared', 'utilities', 85.00, 'Internet Bill', '2026-05-03', v_user1),
    (v_household, v_user1, 'personal', 'dining', 24.50, 'Lunch at Thai Place', '2026-05-05', null),
    (v_household, v_user2, 'personal', 'transport', 45.00, 'Monthly Opal Card', '2026-05-01', null),
    (v_household, v_user1, 'loan', 'health', 65.00, 'Doctor visit (for partner)', '2026-05-07', null),
    (v_household, v_user1, 'shared', 'entertainment', 35.00, 'Netflix + Spotify bundle', '2026-05-02', v_user2),
    (v_household, v_user2, 'shared', 'dining', 78.00, 'Dinner at Italian restaurant', '2026-05-09', v_user1),
    (v_household, v_user1, 'personal', 'shopping', 92.00, 'New running shoes', '2026-05-11', null),
    (v_household, v_user2, 'personal', 'health', 28.00, 'Pharmacy — vitamins', '2026-05-04', null),
    (v_household, v_user1, 'shared', 'rent', 1200.00, 'May Rent', '2026-05-01', v_user2);

END $$;
