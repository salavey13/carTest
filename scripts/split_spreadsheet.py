import pandas as pd
import sys
import os

# File path
file_path = "docs/crewDocs/Surge-V-Spare-Parts-List-0425 .xlsx"
output_dir = "docs/crewDocs/surge_parts_chunks"

# Create output directory
os.makedirs(output_dir, exist_ok=True)

# Read the Excel file
try:
    df = pd.read_excel(file_path, sheet_name=0)
    print(f"Total rows: {len(df)}")
    print(f"Columns: {list(df.columns)}")
    print(f"First column: {df.columns[0]}")
    print(f"\nFirst few rows of first column:")
    print(df.iloc[:20, 0])
except Exception as e:
    print(f"Error reading file: {e}")
    sys.exit(1)

# Define section names to look for (case-insensitive)
section_names = [
    "Electric parts",
    "Wheel sets", 
    "Saddle",
    "Braking&chain sets",
    "Plastic parts",
    "Structural Part",
    "Fronet &Rear suspension part",  # Note: typo in source might be "Front" or "Fronet"
    "Rubber part",
    "Standard parts"
]

# Normalize section names (lowercase for matching)
section_names_lower = [s.lower() for s in section_names]

# Find section start rows
section_starts = []
current_section = None
section_start_row = 0

for idx, row_val in enumerate(df.iloc[:, 0]):
    if pd.isna(row_val):
        continue
    row_str = str(row_val).strip().lower()
    
    # Check if this row matches any section name
    for section_name in section_names_lower:
        if section_name in row_str or row_str in section_name:
            # Save previous section if exists
            if current_section is not None:
                section_starts.append({
                    'name': current_section,
                    'start': section_start_row,
                    'end': idx
                })
            current_section = section_names[section_names_lower.index(section_name)]
            section_start_row = idx
            print(f"Found section '{current_section}' at row {idx}")
            break

# Don't forget the last section
if current_section is not None:
    section_starts.append({
        'name': current_section,
        'start': section_start_row,
        'end': len(df)
    })

print(f"\nFound {len(section_starts)} sections")

# Split and save each section
if section_starts:
    for section in section_starts:
        section_df = df.iloc[section['start']:section['end']].copy()
        
        # Remove rows where first column is the section header itself
        if len(section_df) > 0:
            first_val = str(section_df.iloc[0, 0]).strip().lower()
            if any(name in first_val or first_val in name.lower() for name in section_names_lower):
                section_df = section_df.iloc[1:]
        
        # Skip empty sections
        if len(section_df) == 0:
            print(f"Skipping empty section: {section['name']}")
            continue
        
        # Generate filename
        safe_name = section['name'].replace('/', '-').replace('\\', '-').replace('&', 'and').replace(' ', '_')
        output_file = os.path.join(output_dir, f"Surge_{safe_name}.xlsx")
        
        # Save to Excel
        section_df.to_excel(output_file, index=False, engine='openpyxl')
        
        # Get file size
        file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
        print(f"Saved '{section['name']}' ({len(section_df)} rows, {file_size_mb:.1f} MB) -> {output_file}")
else:
    print("No sections found! Saving full dataset as single file...")
    df.to_excel(os.path.join(output_dir, "Surge_Full_List.xlsx"), index=False, engine='openpyxl')

print("\nDone!")
