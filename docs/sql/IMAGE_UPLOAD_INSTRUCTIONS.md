# Image Upload Instructions for VipBike Configurator

## Overview

This document provides step-by-step instructions for uploading the extracted images to Supabase storage. All images have been extracted and are located in `/home/z/my-project/download/extracted_images/`.

---

## Current Image Locations

### Motorcycle Images (15 files)
Located at: `/home/z/my-project/download/extracted_images/`

| Source File | Target Supabase Path |
|-------------|---------------------|
| vipbike-g8.png | `carpix/vipbike-g8/image_1.jpg` |
| vipbike-g8-2.png | `carpix/vipbike-g8-2/image_1.jpg` |
| vipbike-dmg.png | `carpix/vipbike-dmg/image_1.jpg` |
| vipbike-dk.png | `carpix/vipbike-dk/image_1.jpg` |
| vipbike-r1.png | `carpix/vipbike-r1/image_1.jpg` |
| vipbike-r2.png | `carpix/vipbike-r2/image_1.jpg` |
| vipbike-r3.png | `carpix/vipbike-r3/image_1.jpg` |
| vipbike-r6.png | `carpix/vipbike-r6/image_1.jpg` |
| vipbike-rz.png | `carpix/vipbike-rz/image_1.jpg` |
| vipbike-v6.png | `carpix/vipbike-v6/image_1.jpg` |
| vipbike-jy.png | `carpix/vipbike-jy/image_1.jpg` |
| vipbike-xf.png | `carpix/vipbike-xf/image_1.jpg` |
| vipbike-z1000.png | `carpix/vipbike-z1000/image_1.jpg` |
| vipbike-dn.png | `carpix/vipbike-dn/image_1.jpg` |
| vipbike-a4.png | `carpix/vipbike-a4/image_1.jpg` |

### Parts Images (20 files)
Located at: `/home/z/my-project/download/extracted_images/parts/`

| Source File | Target Supabase Path |
|-------------|---------------------|
| helmet.png | `carpix/parts/helmet.jpg` |
| helmet_e4.png | `carpix/parts/helmet_e4.jpg` |
| abs_system.png | `carpix/parts/abs_system.jpg` |
| cbs_system.png | `carpix/parts/cbs_system.jpg` |
| brembo_brakes.png | `carpix/parts/brembo_brakes.jpg` |
| tft_display.png | `carpix/parts/tft_display.jpg` |
| bluetooth_alarm.png | `carpix/parts/bluetooth_alarm.jpg` |
| cnc_footpegs.png | `carpix/parts/cnc_footpegs.jpg` |
| front_shock.png | `carpix/parts/front_shock.jpg` |
| rear_shock.png | `carpix/parts/rear_shock.jpg` |
| rear_tire.png | `carpix/parts/rear_tire.jpg` |
| motor_5000w.png | `carpix/parts/motor_5000w.jpg` |
| motor_8000w.png | `carpix/parts/motor_8000w.jpg` |
| motor_10000w.png | `carpix/parts/motor_10000w.jpg` |
| battery_50ah.png | `carpix/parts/battery_50ah.jpg` |
| battery_60ah.png | `carpix/parts/battery_60ah.jpg` |
| battery_80ah.png | `carpix/parts/battery_80ah.jpg` |
| battery_li_50ah.png | `carpix/parts/battery_li_50ah.jpg` |
| battery_li_60ah.png | `carpix/parts/battery_li_60ah.jpg` |
| battery_li_80ah.png | `carpix/parts/battery_li_80ah.jpg` |

---

## Supabase Storage Configuration

### Storage URL Pattern
```
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/{path}
```

### Required Bucket Structure
```
carpix/
├── vipbike-g8/
│   └── image_1.jpg
├── vipbike-g8-2/
│   └── image_1.jpg
├── vipbike-dmg/
│   └── image_1.jpg
├── vipbike-dk/
│   └── image_1.jpg
├── vipbike-r1/
│   └── image_1.jpg
├── vipbike-r2/
│   └── image_1.jpg
├── vipbike-r3/
│   └── image_1.jpg
├── vipbike-r6/
│   └── image_1.jpg
├── vipbike-rz/
│   └── image_1.jpg
├── vipbike-v6/
│   └── image_1.jpg
├── vipbike-jy/
│   └── image_1.jpg
├── vipbike-xf/
│   └── image_1.jpg
├── vipbike-z1000/
│   └── image_1.jpg
├── vipbike-dn/
│   └── image_1.jpg
├── vipbike-a4/
│   └── image_1.jpg
└── parts/
    ├── helmet.jpg
    ├── helmet_e4.jpg
    ├── abs_system.jpg
    ├── cbs_system.jpg
    ├── brembo_brakes.jpg
    ├── tft_display.jpg
    ├── bluetooth_alarm.jpg
    ├── cnc_footpegs.jpg
    ├── front_shock.jpg
    ├── rear_shock.jpg
    ├── rear_tire.jpg
    ├── motor_5000w.jpg
    ├── motor_8000w.jpg
    ├── motor_10000w.jpg
    ├── battery_50ah.jpg
    ├── battery_60ah.jpg
    ├── battery_80ah.jpg
    ├── battery_li_50ah.jpg
    ├── battery_li_60ah.jpg
    └── battery_li_80ah.jpg
```

---

## Upload Methods

### Method 1: Manual Upload via Supabase Dashboard

1. Navigate to Supabase Dashboard → Storage → carpix
2. Create folders for each motorcycle model (e.g., `vipbike-g8`)
3. Upload each image with filename `image_1.jpg`
4. Create `parts` folder and upload all parts images

### Method 2: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Upload motorcycle images
supabase storage upload carpix vipbike-g8.png --destination vipbike-g8/image_1.jpg
supabase storage upload carpix vipbike-g8-2.png --destination vipbike-g8-2/image_1.jpg
# ... repeat for all motorcycles

# Upload parts images
supabase storage upload carpix parts/helmet.png --destination parts/helmet.jpg
# ... repeat for all parts
```

### Method 3: Using the Image Upload Skill

If you have the agent's image upload skill available, use the following prompt:

```
Upload all images from /home/z/my-project/download/extracted_images/ to Supabase storage bucket 'carpix':

Motorcycle images (rename .png to .jpg and place in subfolder):
- vipbike-g8.png → carpix/vipbike-g8/image_1.jpg
- vipbike-g8-2.png → carpix/vipbike-g8-2/image_1.jpg
- vipbike-dmg.png → carpix/vipbike-dmg/image_1.jpg
- vipbike-dk.png → carpix/vipbike-dk/image_1.jpg
- vipbike-r1.png → carpix/vipbike-r1/image_1.jpg
- vipbike-r2.png → carpix/vipbike-r2/image_1.jpg
- vipbike-r3.png → carpix/vipbike-r3/image_1.jpg
- vipbike-r6.png → carpix/vipbike-r6/image_1.jpg
- vipbike-rz.png → carpix/vipbike-rz/image_1.jpg
- vipbike-v6.png → carpix/vipbike-v6/image_1.jpg
- vipbike-jy.png → carpix/vipbike-jy/image_1.jpg
- vipbike-xf.png → carpix/vipbike-xf/image_1.jpg
- vipbike-z1000.png → carpix/vipbike-z1000/image_1.jpg
- vipbike-dn.png → carpix/vipbike-dn/image_1.jpg
- vipbike-a4.png → carpix/vipbike-a4/image_1.jpg

Parts images (rename .png to .jpg):
- parts/helmet.png → carpix/parts/helmet.jpg
- parts/helmet_e4.png → carpix/parts/helmet_e4.jpg
- parts/abs_system.png → carpix/parts/abs_system.jpg
- parts/cbs_system.png → carpix/parts/cbs_system.jpg
- parts/brembo_brakes.png → carpix/parts/brembo_brakes.jpg
- parts/tft_display.png → carpix/parts/tft_display.jpg
- parts/bluetooth_alarm.png → carpix/parts/bluetooth_alarm.jpg
- parts/cnc_footpegs.png → carpix/parts/cnc_footpegs.jpg
- parts/front_shock.png → carpix/parts/front_shock.jpg
- parts/rear_shock.png → carpix/parts/rear_shock.jpg
- parts/rear_tire.png → carpix/parts/rear_tire.jpg
- parts/motor_5000w.png → carpix/parts/motor_5000w.jpg
- parts/motor_8000w.png → carpix/parts/motor_8000w.jpg
- parts/motor_10000w.png → carpix/parts/motor_10000w.jpg
- parts/battery_50ah.png → carpix/parts/battery_50ah.jpg
- parts/battery_60ah.png → carpix/parts/battery_60ah.jpg
- parts/battery_80ah.png → carpix/parts/battery_80ah.jpg
- parts/battery_li_50ah.png → carpix/parts/battery_li_50ah.jpg
- parts/battery_li_60ah.png → carpix/parts/battery_li_60ah.jpg
- parts/battery_li_80ah.png → carpix/parts/battery_li_80ah.jpg
```

---

## Post-Upload Steps

### 1. Update Image URLs in Code

After uploading to Supabase, update the `image_url` properties in the configurator page:

**Before (local):**
```typescript
image_url: "/configurator/vipbike-g8.png"
```

**After (Supabase):**
```typescript
image_url: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-g8/image_1.jpg"
```

### 2. Verify Public Access

Ensure the `carpix` bucket has public read access:
1. Go to Supabase Dashboard → Storage → carpix
2. Click "Policies"
3. Add policy: `Allow public read access`

### 3. Test URLs

Verify each image is accessible:
```
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-g8/image_1.jpg
```

---

## Image Specifications

| Category | Recommended Size | Format | Notes |
|----------|-----------------|--------|-------|
| Motorcycle images | 800×600 px | JPG/PNG | Main product images |
| Parts images | 400×400 px | JPG/PNG | Accessory thumbnails |
| Gallery images | 800×600 px | JPG | Optional additional angles |

---

## Complete URL Reference

After upload, these URLs will be active:

### Motorcycles
```
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-g8/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-g8-2/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-dmg/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-dk/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-r1/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-r2/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-r3/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-r6/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-rz/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-v6/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-jy/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-xf/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-z1000/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-dn/image_1.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vipbike-a4/image_1.jpg
```

### Parts
```
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/helmet.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/helmet_e4.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/abs_system.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/cbs_system.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/brembo_brakes.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/tft_display.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/bluetooth_alarm.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/cnc_footpegs.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/front_shock.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/rear_shock.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/rear_tire.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/motor_5000w.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/motor_8000w.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/motor_10000w.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/battery_50ah.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/battery_60ah.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/battery_80ah.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/battery_li_50ah.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/battery_li_60ah.jpg
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/parts/battery_li_80ah.jpg
```
