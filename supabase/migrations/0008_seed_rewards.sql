-- Demo rewards — clearly labelled mock offers for development/testing.
-- Apply via: Supabase Dashboard → SQL Editor → paste → Run

insert into rewards (partner_name, offer_description, milestone_required, expiry_date) values
  ('Cult.fit',        '20% off any monthly plan — your first milestone reward',    7,   '2027-12-31'),
  ('Decathlon India', '₹500 off orders above ₹3,000',                             30,  '2027-12-31'),
  ('MyFitnessPal',    '1 month Premium free — sync your nutrition data',           100, '2027-12-31');
