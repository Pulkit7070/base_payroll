import fs from 'fs';
import path from 'path';
import http from 'http';

async function uploadCSV() {
  const csvPath = path.join(process.cwd(), 'payroll-test-data.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
  
  const body = 
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="payroll-test-data.csv"\r\n` +
    `Content-Type: text/csv\r\n\r\n` +
    fileContent + '\r\n' +
    `--${boundary}--\r\n`;

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/bulk-payroll/upload',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(body),
      'Authorization': 'Bearer dev-token',
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

uploadCSV().catch(console.error);
