export type VehicleType = 'bike' | 'scooter' | 'quad' | 'service';

export interface VehicleAsset {
  id: string; // Supabase primary key
  make: string;
  model: string;
  description: string;
  daily_price_rub: number;
  image_url: string; // The primary, verified image URL
  type: VehicleType;
  owner_id: string;
  is_verified: boolean; // Does this data reflect the final state in DB?
  specs: {
    engine_cc?: number;
    horsepower?: number;
    weight_kg?: number;
    top_speed_kmh?: number;
    category?: 'Supersport' | 'Hypersport' | 'Naked' | 'Cruiser' | 'Neo-retro' | 'Scooter';
    gallery?: string[]; // Additional verified image URLs
  };
}

export const V_FLEET_ASSETS: VehicleAsset[] = [
  // --- Verified Bikes from Supabase CSV ---
  {
    id: 'bmw-f800r', make: 'BMW', model: 'F800R',
    description: "Надежный и сбалансированный нейкед от BMW. Отлично подходит как для ежедневных поездок по городу, так и для динамичных прохватов по извилистым дорогам. Легкий в управлении.",
    daily_price_rub: 8000, // Price updated from VK list
    image_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250725_233954_446-99c22a2b-ac1b-4916-bf79-9727c01ff5f4.jpg',
    type: 'bike', owner_id: '356282674', is_verified: true,
    specs: { engine_cc: 798, horsepower: 90, weight_kg: 202, top_speed_kmh: 215, category: 'Naked', gallery: [ 'https://cdni.autocarindia.com/utils/imageresizer.ashx?n=http://cms.haymarketindia.net/model/uploads/modelimages/BMW-F-800-R-050420181635.jpg&w=872&h=578&q=75&c=1' ] }
  },
  {
    id: 'bmw-s1000rr-hp4', make: 'BMW', model: 'S1000RR HP4 Race',
    description: "Трековый болид с карбоновой рамой и маятником, мощностью 215 л.с. и весом всего 171 кг. Это не мотоцикл, это ультимативное оружие для гоночного трека. Строго для профессионалов.",
    daily_price_rub: 16000, // Price updated from VK list (using lower of the two)
    image_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250725_234718_117-73a4d395-ed24-4344-9758-34f5db943668.jpg',
    type: 'bike', owner_id: '356282674', is_verified: true,
    specs: { engine_cc: 999, horsepower: 215, weight_kg: 171, top_speed_kmh: 300, category: 'Hypersport', gallery: [ 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250725_234718_117-c97c7dc1-0f0f-4ad8-9804-baf326e6d51a.jpg', 'https://www.bmw-motorrad.ca/content/dam/bmw/marketCA/bmw-motorrad_ca/images/bike-pages/2018-hp4-race/2018-hp4-race-05.jpg.asset.1600860882798.jpg' ] }
  },
  {
    id: 'ducati-x-diavel', make: 'Ducati', model: 'X-Diavel S',
    description: "Итальянский пауэр-круизер, сочетающий в себе расслабленную посадку и адреналин спортбайка. Двигатель Testastretta DVT 1262 - это чистая мощь и невероятные эмоции.",
    daily_price_rub: 12000, // Price updated from VK
    image_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250725_233954_223-9d491e27-ba4a-4bcd-8c1d-23e426e1fdd5.jpg',
    type: 'bike', owner_id: '356282674', is_verified: true,
    specs: { engine_cc: 1262, horsepower: 152, weight_kg: 247, top_speed_kmh: 250, category: 'Cruiser', gallery: [ 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/diavel_v4_p_01_hero.jpg', 'https://cdn-7.motorsport.com/images/amp/Y99JBEo0/s1000/ducati-xdiavel-s-1.jpg' ] }
  },
  {
    id: 'harley-fat-boy', make: 'Harley-Davidson', model: 'Fat Boy 114 Custom',
    description: "Легендарный Fat Boy в максимальном тюнинге. Мощный двигатель Milwaukee-Eight™ 114 и брутальный внешний вид. Этот байк - заявление. Только для опытных райдеров.",
    daily_price_rub: 9000,
    image_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/harley-davidson-fat-boy.jpg',
    type: 'bike', owner_id: '356282674', is_verified: true,
    specs: { engine_cc: 1868, horsepower: 94, weight_kg: 317, top_speed_kmh: 190, category: 'Cruiser', gallery: [ 'https://cdn.dealeraccelerate.com/amt/1/4950/296726/1920x1440/2022-harley-davidson-fat-boy-114-flfbs' ] }
  },
  {
    id: 'honda-cbr600rr-2005', make: 'Honda', model: 'CBR600RR', // Consolidated from VK list
    description: "Легендарный спортбайк, заточенный под трек. Резкий, точный и требовательный к пилоту. Классика жанра для тех, кто понимает толк в скорости.",
    daily_price_rub: 8000, // Using lower price from VK
    image_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250725_233953_812-5b7b4b78-61af-4efa-a1f5-8be849862069.jpg',
    type: 'bike', owner_id: '356282674', is_verified: true,
    specs: { engine_cc: 599, horsepower: 117, weight_kg: 194, top_speed_kmh: 255, category: 'Supersport', gallery: [ 'https://upload.wikimedia.org/wikipedia/commons/2/23/Honda_CBR_600_RR_2005.jpg' ] }
  },
  {
    id: 'kawasaki-ninja-400', make: 'Kawasaki', model: 'Ninja 400',
    description: "Идеальный спортбайк для начинающих и для города. Легкий, маневренный, с дружелюбным характером, но способный подарить массу удовольствия и на извилистых дорогах.",
    daily_price_rub: 4000,
    image_url: 'https://www.kawasaki.com/images/galleries/2023_Ninja_400_GN1_RF_1.jpg',
    type: 'bike', owner_id: '356282674', is_verified: true,
    specs: { engine_cc: 399, horsepower: 45, weight_kg: 168, top_speed_kmh: 190, category: 'Supersport', gallery: [ 'https://cdp.azureedge.net/products/USA/KA/2023/MC/SPORT/NINJA_400/50/LIME_GREEN_-_EBONY/20230713130107085.jpg' ] }
  },
  {
    id: 'suzuki-skywave-250', make: 'Suzuki', model: 'Skywave 250',
    description: "Комфортный и стильный макси-скутер. Идеальный вариант для поездок по городу без пробок. Не требует категории 'А', достаточно категории 'B' или 'M'.",
    daily_price_rub: 4000, // Price updated from VK
    image_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250725_233954_068-13303855-fef2-460e-98ee-af0ec9f26577.jpg',
    type: 'scooter', owner_id: '356282674', is_verified: true,
    specs: { engine_cc: 249, horsepower: 25, weight_kg: 211, top_speed_kmh: 125, category: 'Scooter', gallery: [ 'https://bikeswiki.com/images/a/a2/Suzuki-Skywave-250-Type-M-2007.jpg' ] }
  },
  {
    id: 'voge-525-acx', make: 'VOGE', model: '525 ACX',
    description: "Абсолютно новый, удобный и маневренный мотоцикл в нео-ретро стиле. Идеален как для города, так и для легких загородных прохватов. Один из самых свежих байков в парке!",
    daily_price_rub: 8000, // Price updated from VK
    image_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/voge-525-acx-2023-a.jpg',
    type: 'bike', owner_id: '356282674', is_verified: true,
    specs: { engine_cc: 494, horsepower: 47, weight_kg: 185, top_speed_kmh: 160, category: 'Neo-retro', gallery: [ 'https://ymoto.ru/uploads/posts/2023-11/1700213032_voge-525-acx-2023-2.jpg', 'https://cdn.motor1.com/images/mgl/pP6Zgv/s3/voge-525-acx-scrambler.jpg' ] }
  },
  
  // --- New Bikes Identified from VK List ---
  {
    id: 'hd-nightster-1200', make: 'Harley-Davidson', model: 'Nightster 1200 Custom',
    description: "Кастомный Nightster. Дерзкий, стильный и громкий. Идеальный выбор для тех, кто хочет выделиться в потоке.",
    daily_price_rub: 9000, image_url: '', type: 'bike', owner_id: '356282674', is_verified: false,
    specs: { category: 'Cruiser', gallery: [] }
  },
  {
    id: 'voge-ac300', make: 'Voge', model: 'AC300',
    description: "Младший брат 525-й модели. Легкий и стильный нео-ретро скремблер, отлично подходящий для начинающих райдеров и города.",
    daily_price_rub: 6000, image_url: '', type: 'bike', owner_id: '356282674', is_verified: false,
    specs: { category: 'Neo-retro', gallery: [] }
  },
  {
    id: 'honda-lead-custom', make: 'Honda', model: 'Lead Custom',
    description: "Эксклюзивный кастомный скутер Honda Lead. Уникальный стиль и непревзойденная надежность для городских джунглей.",
    daily_price_rub: 5000, image_url: '', type: 'scooter', owner_id: '356282674', is_verified: false,
    specs: { category: 'Scooter', gallery: [] }
  },
  {
    id: 'vento-retro', make: 'Vento', model: 'Retro Scooter',
    description: "Стильный скутер в ретро-дизайне. Идеален для фотосессий и неспешных прогулок по центру города.",
    daily_price_rub: 5000, image_url: '', type: 'scooter', owner_id: '356282674', is_verified: false,
    specs: { category: 'Scooter', gallery: [] }
  },
  {
    id: 'mv-agusta-brutale-1090rr', make: 'MV Agusta', model: 'Brutale 1090RR',
    description: "Итальянский шедевр. Экстремальный нейкед с четырехцилиндровым двигателем и потрясающим дизайном. Для самых искушенных пилотов.",
    daily_price_rub: 14000, image_url: '', type: 'bike', owner_id: '356282674', is_verified: false,
    specs: { category: 'Naked', gallery: [] }
  }
];

// --- Non-Vehicle Products ---
// These need a separate data model and UI.
export const OTHER_PRODUCTS = [
    { id: 'quad-rental', name: 'Аренда квадроциклов и багги', price: 2000 },
    { id: 'winter-storage', name: 'Ответственное Хранение мотоцикла на зиму', price: 1600 },
    // Combo offers like "Пара BMW" need to be handled by booking logic, not as separate items.
];