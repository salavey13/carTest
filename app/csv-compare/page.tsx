"use client";

import React, { useState, useCallback } from "react";
import { parse } from "papaparse";

interface InventoryItem {
  id: string;
  quantity: number;
}

const CSVCompare = () => {
  const [csv1, setCsv1] = useState("");
  const [csv2, setCsv2] = useState("");
  const [inventory1, setInventory1] = useState<InventoryItem[]>([]);
  const [inventory2, setInventory2] = useState<InventoryItem[]>([]);
  const [differences, setDifferences] = useState<string[]>([]);

// EXAMPLE:
/*
id,make,model,description,type,specs,image_url
"евро лето кружева","Евро","Лето Кружева","Бежевая, полосочка","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""kruzheva"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 5}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-kruzheva.jpg"
"евро зима кружева","Евро","Зима Кружева","Бежевая, полузакрытая","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""kruzheva"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-zima-kruzheva.jpg"
"евро лето огурцы","Евро","Лето Огурцы","Бежевая, фрактальный узор","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""ogurtsy"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-ogurtsy.jpg"
"евро зима огурцы","Евро","Зима Огурцы","Бежевая, фрактальный узор","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""ogurtsy"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 6}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-zima-ogurtsy.jpg"
"евро лето адель","Евро","Лето Адель","Бежевая, голубой горошек","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""adel"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-adel.jpg"
"евро зима адель","Евро","Зима Адель","Бежевая, голубой горошек","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""adel"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-zima-adel.jpg"
"евро лето мальвина","Евро","Лето Мальвина","Бежевая, мятный фиолетовый цветок","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""malvina"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-malvina.jpg"
"евро зима мальвина","Евро","Зима Мальвина","Бежевая, мятный фиолетовый цветок","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""malvina"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-zima-malvina.jpg"
"евро лето флора","Евро","Лето Флора","Бежевая, цветочки мал.","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""flora"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-flora.jpg"
"евро зима флора","Евро","Зима Флора","Бежевая, цветочки мал.","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""flora"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-zima-flora.jpg"
"евро лето флора 2","Евро","Лето Флора 2","Бежевая, цветочки ср.","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""flora2"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-flora2.jpg"
"евро зима флора 2","Евро","Зима Флора 2","Бежевая, цветочки ср.","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""flora2"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-zima-flora2.jpg"
"евро лето флора 3","Евро","Лето Флора 3","Бежевая, цветочки бол.","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""flora3"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-flora3.jpg"
"евро зима флора 3","Евро","Зима Флора 3","Бежевая, цветочки бол.","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""flora3"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-zima-flora3.jpg"
"евро лето лаванда","Евро","Лето Лаванда","Бежевая, фиолетовый узор","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""lavanda"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-lavanda.jpg"
"евро зима лаванда","Евро","Зима Лаванда","Бежевая, фиолетовый узор","wb_item","{""size"": ""180x220"", ""color"": ""beige"", ""pattern"": ""lavanda"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-zima-lavanda.jpg"
"2 лето кружева","2","Лето Кружева","Голубая, полосочка","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""kruzheva"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 7}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-leto-kruzheva.jpg"
"2 зима кружева","2","Зима Кружева","Голубая, полузакрытая","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""kruzheva"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-zima-kruzheva.jpg"
"2 лето огурцы","2","Лето Огурцы","Голубая, фрактальный узор","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""ogurtsy"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-leto-ogurtsy.jpg"
"2 зима огурцы","2","Зима Огурцы","Голубая, фрактальный узор","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""ogurtsy"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 8}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-zima-ogurtsy.jpg"
"2 лето адель","2","Лето Адель","Голубая, голубой горошек","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""adel"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-leto-adel.jpg"
"2 зима адель","2","Зима Адель","Голубая, голубой горошек","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""adel"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-zima-adel.jpg"
"2 лето мальвина","2","Лето Мальвина","Голубая, мятный фиолетовый цветок","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""malvina"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-leto-malvina.jpg"
"2 зима мальвина","2","Зима Мальвина","Голубая, мятный фиолетовый цветок","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""malvina"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-zima-malvina.jpg"
"2 лето флора","2","Лето Флора","Голубая, цветочки мал.","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""flora"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-leto-flora.jpg"
"2 зима флора","2","Зима Флора","Голубая, цветочки мал.","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""flora"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-zima-flora.jpg"
"2 лето флора 2","2","Лето Флора 2","Голубая, цветочки ср.","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""flora2"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-leto-flora2.jpg"
"2 зима флора 2","2","Зима Флора 2","Голубая, цветочки ср.","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""flora2"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-zima-flora2.jpg"
"2 лето флора 3","2","Лето Флора 3","Голубая, цветочки бол.","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""flora3"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-leto-flora3.jpg"
"2 зима флора 3","2","Зима Флора 3","Голубая, цветочки бол.","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""flora3"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-zima-flora3.jpg"
"2 лето лаванда","2","Лето Лаванда","Голубая, фиолетовый узор","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""lavanda"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-leto-lavanda.jpg"
"2 зима лаванда","2","Зима Лаванда","Голубая, фиолетовый узор","wb_item","{""size"": ""200x220"", ""color"": ""blue"", ""pattern"": ""lavanda"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A2"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-zima-lavanda.jpg"
"евро макси лето кружева","Евро Макси","Лето Кружева","Красная, полосочка","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""kruzheva"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A7"", ""quantity"": 7}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-leto-kruzheva.jpg"
"евро макси зима кружева","Евро Макси","Зима Кружева","Красная, полузакрытая","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""kruzheva"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-zima-kruzheva.jpg"
"евро макси лето огурцы","Евро Макси","Лето Огурцы","Красная, фрактальный узор","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""ogurtsy"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A7"", ""quantity"": 4}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-leto-ogurtsy.jpg"
"евро макси зима огурцы","Евро Макси","Зима Огурцы","Красная, фрактальный узор","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""ogurtsy"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 11}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-zima-ogurtsy.jpg"
"евро макси лето адель","Евро Макси","Лето Адель","Красная, голубой горошек","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""adel"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-leto-adel.jpg"
"евро макси зима адель","Евро Макси","Зима Адель","Красная, голубой горошек","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""adel"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-zima-adel.jpg"
"евро макси лето мальвина","Евро Макси","Лето Мальвина","Красная, мятный фиолетовый цветок","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""malvina"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-leto-malvina.jpg"
"евро макси зима мальвина","Евро Макси","Зима Мальвина","Красная, мятный фиолетовый цветок","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""malvina"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-zima-malvina.jpg"
"евро макси лето флора","Евро Макси","Лето Флора","Красная, цветочки мал.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-leto-flora.jpg"
"евро макси зима флора","Евро Макси","Зима Флора","Красная, цветочки мал.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-zima-flora.jpg"
"евро макси лето флора 2","Евро Макси","Лето Флора 2","Красная, цветочки ср.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora2"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-leto-flora2.jpg"
"евро макси зима флора 2","Евро Макси","Зима Флора 2","Красная, цветочки ср.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora2"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-zima-flora2.jpg"
"евро макси лето флора 3","Евро Макси","Лето Флора 3","Красная, цветочки бол.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora3"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-leto-flora3.jpg"
"евро макси зима флора 3","Евро Макси","Зима Флора 3","Красная, цветочки бол.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora3"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-zima-flora3.jpg"
"евро макси лето лаванда","Евро Макси","Лето Лаванда","Красная, фиолетовый узор","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""lavanda"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-leto-lavanda.jpg"
"евро макси зима лаванда","Евро Макси","Зима Лаванда","Красная, фиолетовый узор","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""lavanda"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-zima-lavanda.jpg"
"наматрасник.90.кружева","Наматрасник","90 Кружева","Салатовый, маленький","wb_item","{""size"": ""90"", ""color"": ""light-green"", ""pattern"": ""kruzheva"", ""season"": null, ""warehouse_locations"": [{""voxel_id"": ""A12"", ""quantity"": 8}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/matrasnik-90-kruzheva.jpg"
"наматрасник.120.кружева","Наматрасник","120 Кружева","Салатовый, маленький","wb_item","{""size"": ""120"", ""color"": ""light-green"", ""pattern"": ""kruzheva"", ""season"": null, ""warehouse_locations"": [{""voxel_id"": ""A4"", ""quantity"": 19}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/matrasnik-120-kruzheva.jpg"
"наматрасник.140.кружева","Наматрасник","140 Кружева","Салатовый, маленький","wb_item","{""size"": ""140"", ""color"": ""light-green"", ""pattern"": ""kruzheva"", ""season"": null, ""warehouse_locations"": [ {""voxel_id"": ""A15"", ""quantity"": 3}, {""voxel_id"": ""A16"", ""quantity"": 2}, {""voxel_id"": ""B4"", ""quantity"": 10}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/matrasnik-140-kruzheva.jpg"
"наматрасник.160.кружева","Наматрасник","160 Кружева","Темно-зеленый, большой","wb_item","{""size"": ""160"", ""color"": ""dark-green"", ""pattern"": ""kruzheva"", ""season"": null, ""warehouse_locations"": [{""voxel_id"": ""A8"", ""quantity"": 1}, {""voxel_id"": ""B4"", ""quantity"": 10}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/matrasnik-160-kruzheva.jpg"
"наматрасник.180.кружева","Наматрасник","180 Кружева","Темно-зеленый, большой","wb_item","{""size"": ""180"", ""color"": ""dark-green"", ""pattern"": ""kruzheva"", ""season"": null, ""warehouse_locations"": [{""voxel_id"": ""A4"", ""quantity"": 6}, {""voxel_id"": ""A12"", ""quantity"": 1}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/matrasnik-180-kruzheva.jpg"
"наматрасник.200.кружева","Наматрасник","200 Кружева","Темно-зеленый, большой","wb_item","{""size"": ""200"", ""color"": ""dark-green"", ""pattern"": ""kruzheva"", ""season"": null, ""warehouse_locations"": [{""voxel_id"": ""A4"", ""quantity"": 7}, {""voxel_id"": ""A16"", ""quantity"": 2}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/matrasnik-200-kruzheva.jpg"
"1.5 лето кружева","1.5","Лето Кружева","Серая, полосочка","wb_item","{""size"": ""150x200"", ""color"": ""gray"", ""pattern"": ""kruzheva"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""B1"", ""quantity"": 8}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-leto-kruzheva.jpg"
"1.5 зима кружева","1.5","Зима Кружева","Серая, полузакрытая","wb_item","{""size"": ""150x200"", ""color"": ""gray"", ""pattern"": ""kruzheva"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""B1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-zima-kruzheva.jpg"
"1.5 лето огурцы","1.5","Лето Огурцы","Серая, фрактальный узор","wb_item","{""size"": ""150x200"", ""color"": ""gray"", ""pattern"": ""ogurtsy"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""B1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-leto-ogurtsy.jpg"
"1.5 зима огурцы","1.5","Зима Огурцы","Серая, фрактальный узор","wb_item","{""size"": ""150x200"", ""color"": ""gray"", ""pattern"": ""ogurtsy"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""B1"", ""quantity"": 7}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-zima-ogurtsy.jpg"
"1.5 лето адель","1.5","Лето Адель","Серая, голубой горошек","wb_item","{""size"": ""150x200"", ""color"": ""gray"", ""pattern"": ""adel"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""B1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-leto-adel.jpg"
"1.5 зима адель","1.5","Зима Адель","Серая, голубой горошек","wb_item","{""size"": ""150x200"", ""color"": ""gray"", ""pattern"": ""adel"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""B1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-zima-adel.jpg"
"1.5 лето мальвина","1.5","Лето Мальвина","Серая, мятный фиолетовый цветок","wb_item","{""size"": ""150x200"", ""color"": ""gray"", ""pattern"": ""malvina"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""B1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-leto-malvina.jpg"
"1.5 зима мальвина","1.5","Зима Мальвина","Серая, мятный фиолетовый цветок","wb_item","{""size"": ""150x200"", ""color"": ""gray"", ""pattern"": ""malvina"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""B1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-zima-malvina.jpg"
"1.5 лето флора","1.5","Лето Флора","Серая, цветочки мал.","wb_item","{""size"": ""150x200"", ""color"": ""gray"", ""pattern"": ""flora"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""B1"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-leto-flora.jpg"
"1.5 зима флора","1.5","Зима Флора","Красная, цветочки мал.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-zima-flora.jpg"
"1.5 лето флора 2","1.5","Лето Флора 2","Красная, цветочки ср.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora2"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-leto-flora2.jpg"
"1.5 зима флора 2","1.5","Зима Флора 2","Красная, цветочки ср.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora2"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-zima-flora2.jpg"
"1.5 лето флора 3","1.5","Лето Флора 3","Красная, цветочки бол.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora3"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-leto-flora3.jpg"
"1.5 зима флора 3","1.5","Зима Флора 3","Красная, цветочки бол.","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""flora3"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-zima-flora3.jpg"
"1.5 лето лаванда","1.5","Лето Лаванда","Красная, фиолетовый узор","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""lavanda"", ""season"": ""leto"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-leto-lavanda.jpg"
"1.5 зима лаванда","1.5","Зима Лаванда","Красная, фиолетовый узор","wb_item","{""size"": ""220x240"", ""color"": ""red"", ""pattern"": ""lavanda"", ""season"": ""zima"", ""warehouse_locations"": [{""voxel_id"": ""A3"", ""quantity"": 0}]}","https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-zima-lavanda.jpg"
*/

  const parseCSV = useCallback(
    (csvText: string, setInventory: (items: InventoryItem[]) => void) => {
      parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const inventoryMap: { [id: string]: number } = {};

          results.data.forEach((row: any) => {
            const id = row["id"];
            let quantity = 0;
            try {
              const specs = JSON.parse(row["specs"]);
              if (specs && specs.warehouse_locations) {
                if (Array.isArray(specs.warehouse_locations)) {
                  specs.warehouse_locations.forEach(
                    (location: { quantity: string | number }) => {
                      quantity += parseInt(location.quantity.toString(), 10) || 0;
                    }
                  );
                }
              }
            } catch (e) {
              // if specs is not an JSON, try to parse value from row.quantity, example: row["warehouse_locations"]
              try {
                if (row["warehouse_locations"]) {
                  quantity = parseInt(row["warehouse_locations"].toString(), 10) || 0;
                }
              } catch (ee) {}
            }

            if (id) {
              inventoryMap[id] = (inventoryMap[id] || 0) + quantity;
            }
          });

          const inventoryList: InventoryItem[] = Object.entries(inventoryMap).map(
            ([id, quantity]) => ({
              id,
              quantity,
            })
          );
          setInventory(inventoryList);
        },
        error: (error) => {
          console.error("CSV parsing error:", error);
          alert("Error parsing CSV. Check console for details.");
        },
      });
    },
    []
  );

  const compareInventories = useCallback(() => {
    const id1 = new Set(inventory1.map((i) => i.id));
    const id2 = new Set(inventory2.map((i) => i.id));

    const addedItems = [...id2].filter((id) => !id1.has(id));
    const removedItems = [...id1].filter((id) => !id2.has(id));
    const modifiedItems = [...id1].filter((id) => id2.has(id));

    const diffs: string[] = [];

    if (addedItems.length > 0) {
      diffs.push(`Added items: ${addedItems.join(", ")}`);
    }
    if (removedItems.length > 0) {
      diffs.push(`Removed items: ${removedItems.join(", ")}`);
    }
    if (modifiedItems.length > 0) {
      diffs.push(`Modified items: ${modifiedItems.join(", ")}`);
    }

    setDifferences(diffs);
  }, [inventory1, inventory2]);

  const handleCsv1Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCsv1 = e.target.value;
    setCsv1(newCsv1);
    parseCSV(newCsv1, setInventory1);
  };

  const handleCsv2Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCsv2 = e.target.value;
    setCsv2(newCsv2);
    parseCSV(newCsv2, setInventory2);
  };

  return (
    <div className="container mx-auto p-4 pt-24">
      <h1 className="text-2xl font-bold mb-4">CSV Inventory Comparison</h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">CSV 1</h2>
          <textarea
            className="w-full h-64 p-2 border rounded"
            placeholder="Paste CSV 1 content here"
            value={csv1}
            onChange={handleCsv1Change}
          />
          <h3 className="text-md font-semibold mt-2">Inventory 1</h3>
          <ul>
            {inventory1.map((item) => (
              <li key={item.id}>
                {item.id}: {item.quantity}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">CSV 2</h2>
          <textarea
            className="w-full h-64 p-2 border rounded"
            placeholder="Paste CSV 2 content here"
            value={csv2}
            onChange={handleCsv2Change}
          />
          <h3 className="text-md font-semibold mt-2">Inventory 2</h3>
          <ul>
            {inventory2.map((item) => (
              <li key={item.id}>
                {item.id}: {item.quantity}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={compareInventories}
      >
        Compare Inventories
      </button>

      {differences.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold">Differences</h2>
          <ul>
            {differences.map((diff, index) => (
              <li key={index}>{diff}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CSVCompare;