-- Chemicals (inventory items)
CREATE TABLE public.chemicals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit TEXT DEFAULT 'ml'
);

-- Service Types (e.g., Basic Wash, Waxing, Deep Clean)
CREATE TABLE public.service_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Car Sizes (e.g., Small, Sedan, SUV, Truck)
CREATE TABLE public.car_sizes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Consumption Rates (chemical usage per service and car size)
CREATE TABLE public.consumption_rates (
  id SERIAL PRIMARY KEY,
  chemical_id INT REFERENCES chemicals(id) ON DELETE CASCADE,
  service_type_id INT REFERENCES service_types(id) ON DELETE CASCADE,
  car_size_id INT REFERENCES car_sizes(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK (amount > 0),
  UNIQUE (chemical_id, service_type_id, car_size_id)
);

-- Orders (synchronized via external Automa script)
CREATE TABLE public.orders (
  id SERIAL PRIMARY KEY,
  crm_name TEXT NOT NULL, -- Source CRM identifier
  service_id TEXT NOT NULL, -- Unique order ID from CRM
  service_type TEXT NOT NULL, -- Matches service_types.name
  car_size TEXT NOT NULL, -- Matches car_sizes.name
  completed_at TIMESTAMP NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  UNIQUE (crm_name, service_id)
);

-- Enable Realtime for orders table
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Processed Services (track processed orders)
CREATE TABLE public.processed_services (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  processed_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_services ENABLE ROW LEVEL SECURITY;

-- Policies for chemicals
CREATE POLICY "Allow read for all authenticated" ON chemicals 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow update for admins" ON chemicals 
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.user_id = auth.jwt() ->> 'chat_id' 
      AND users.role = 'admin'
    )
  );

-- Policies for service_types
CREATE POLICY "Allow read for all authenticated" ON service_types 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow all for admins" ON service_types 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.user_id = auth.jwt() ->> 'chat_id' 
      AND users.role = 'admin'
    )
  );

-- Policies for car_sizes
CREATE POLICY "Allow read for all authenticated" ON car_sizes 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow all for admins" ON car_sizes 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.user_id = auth.jwt() ->> 'chat_id' 
      AND users.role = 'admin'
    )
  );

-- Policies for consumption_rates
CREATE POLICY "Allow read for all authenticated" ON consumption_rates 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow all for admins" ON consumption_rates 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.user_id = auth.jwt() ->> 'chat_id' 
      AND users.role = 'admin'
    )
  );

-- Policies for orders
CREATE POLICY "Allow read for all authenticated" ON orders 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow insert for admin or system" ON orders 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.user_id = auth.jwt() ->> 'chat_id' 
      AND users.role IN ('admin', 'system')
    )
  );

-- Policies for processed_services
CREATE POLICY "Allow read for all authenticated" ON processed_services 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow insert for admin or system" ON processed_services 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.user_id = auth.jwt() ->> 'chat_id' 
      AND users.role IN ('admin', 'system')
    )
  );

-- Insert Demo Data
-- Chemicals
INSERT INTO chemicals (name, quantity) VALUES
  ('Shampoo', 5000),
  ('Wax', 3000),
  ('Polish', 4000);

-- Service Types
INSERT INTO service_types (name) VALUES
  ('Basic Wash'),
  ('Waxing'),
  ('Deep Clean');

-- Car Sizes
INSERT INTO car_sizes (name) VALUES
  ('Small'),
  ('Sedan'),
  ('SUV'),
  ('Truck');

-- Consumption Rates
INSERT INTO consumption_rates (chemical_id, service_type_id, car_size_id, amount) VALUES
  (1, 1, 1, 30),  -- Shampoo, Basic Wash, Small: 30ml
  (1, 1, 2, 50),  -- Shampoo, Basic Wash, Sedan: 50ml
  (1, 1, 3, 70),  -- Shampoo, Basic Wash, SUV: 70ml
  (1, 1, 4, 100), -- Shampoo, Basic Wash, Truck: 100ml
  (2, 2, 1, 100), -- Wax, Waxing, Small: 100ml
  (2, 2, 2, 150), -- Wax, Waxing, Sedan: 150ml
  (2, 2, 3, 200), -- Wax, Waxing, SUV: 200ml
  (2, 2, 4, 250), -- Wax, Waxing, Truck: 250ml
  (3, 3, 1, 50),  -- Polish, Deep Clean, Small: 50ml
  (3, 3, 2, 80),  -- Polish, Deep Clean, Sedan: 80ml
  (3, 3, 3, 120), -- Polish, Deep Clean, SUV: 120ml
  (3, 3, 4, 150); -- Polish, Deep Clean, Truck: 150ml

-- Orders (simulating Automa sync)
INSERT INTO orders (crm_name, service_id, service_type, car_size, completed_at) VALUES
  ('crm1', 'order1', 'Basic Wash', 'Small', NOW() - INTERVAL '2 days'),
  ('crm1', 'order2', 'Basic Wash', 'Sedan', NOW() - INTERVAL '1 day'),
  ('crm2', 'order3', 'Waxing', 'SUV', NOW() - INTERVAL '5 hours'),
  ('crm2', 'order4', 'Deep Clean', 'Truck', NOW() - INTERVAL '3 hours'),
  ('crm3', 'order5', 'Waxing', 'Small', NOW() - INTERVAL '1 hour'),
  ('crm3', 'order6', 'Deep Clean', 'Sedan', NOW() - INTERVAL '30 minutes');
