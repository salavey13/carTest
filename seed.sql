-- ЕСЛИ ДОБАВЛЯТЬ ЧЕРЕЗ RUN SQL В SUPABASE
-- Russian Questions
insert into public.questions (id, text, theme, position) values
(1, 'Какой звук двигателя заводит тебя утром?', 'sound', 1),
(2, 'Выбери идеальный маршрут:', 'road', 2),
(3, 'Что важнее в салоне?', 'interior', 3);

-- Test Result Cars
insert into public.cars (id, make, model, description, daily_price, is_test_result, image_url, rent_link) values
('tesla-roadster', 'Tesla', 'Roadster', 'Электрокар будущего...', 0, true, '/tesla.jpg', '/rent/na'),
('ferrari-sf90', 'Ferrari', 'SF90 Stradale', 'Итальянская мощь...', 0, true, '/ferrari.jpg', '/rent/na'),
('porsche-911', 'Porsche', '911 GT3', 'Немецкая точность...', 0, true, '/porsche.jpg', '/rent/na');



-- Answers
insert into public.answers (question_id, text, result) values
(1, 'Тихий гул электромотора', 'tesla-roadster'),
(1, 'Рев V12 как в Формуле 1', 'ferrari-sf90'),
(1, 'Басистый рокот американского V8', 'porsche-911'),
(2, 'Трасса Нюрбургринг', 'porsche-911'),
(2, 'Калифорнийское шоссе', 'tesla-roadster'),
(2, 'Горный серпантин', 'ferrari-sf90'),
(3, 'Сенсорные экраны и ИИ', 'tesla-roadster'),
(3, 'Запах натуральной кожи', 'ferrari-sf90'),
(3, 'Углеродное волокно повсюду', 'porsche-911');



-- Rental Cars
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link) values
('lamborghini-huracan', 'Lamborghini', 'Huracan EVO', 'Яркий суперкар...', 1500, '/lambo.jpg', '/rent/huracan'),
('mclaren-720s', 'McLaren', '720S', 'Британский шедевр...', 1700, '/mclaren.jpg', '/rent/720s');

