#!/bin/bash

# Generate test user CSV files for different test scales

echo "Generating user CSV files..."

# Function to generate CSV with N users
generate_csv() {
  local count=$1
  local filename=$2
  
  echo "userId,password" > "$filename"
  
  for i in $(seq 0 $((count-1))); do
    printf "test%04d,testtest\n" $i >> "$filename"
  done
  
  echo "✅ Created $filename with $count users"
}

# Generate CSV files for different test scales
generate_csv 10 "test-users-10.csv"
generate_csv 50 "test-users-50.csv"
generate_csv 100 "test-users-100.csv"
generate_csv 500 "test-users-500.csv"
generate_csv 1000 "test-users-1000.csv"
generate_csv 2000 "test-users-2000.csv"
generate_csv 5000 "test-users-5000.csv"
generate_csv 10000 "test-users-10000.csv"

echo ""
echo "📊 Summary:"
ls -lh test-users-*.csv

