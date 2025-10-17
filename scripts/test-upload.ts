import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function uploadCSV() {
  try {
    const csvPath = path.join(process.cwd(), 'payroll-test-data.csv');
    const fileStream = fs.createReadStream(csvPath);
    
    const formData = new FormData();
    formData.append('file', fileStream, 'payroll-test-data.csv');
    
    const response = await fetch('http://localhost:3001/api/bulk-payroll/upload', {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Bearer dev-token',
      },
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

uploadCSV();
