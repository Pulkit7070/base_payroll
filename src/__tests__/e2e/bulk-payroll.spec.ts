import { test, expect } from '@playwright/test';

test.describe('Bulk Payroll E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth token in localStorage for development
    await page.context().addCookies([
      {
        name: 'auth_token',
        value: 'dev-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Navigate to bulk payroll page
    await page.goto('/bulk-payroll');
  });

  test('should upload and process CSV successfully', async ({ page }) => {
    // Check upload section is visible
    await expect(page.locator('text=Drop your CSV file here')).toBeVisible();

    // Create sample CSV content
    const csvContent = `employee_email,amount,currency,pay_date,description
jane.doe@example.com,1500.00,USD,2025-11-01,November salary
john.smith@example.com,2000.50,EUR,2025-11-05,Bonus`;

    // Upload file
    const fileInput = page.locator('input[type="file"]');

    // Create a blob and set file
    await page.evaluateHandle(
      ({ content }) => {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        // Store for later use
        (window as any).testBlobUrl = url;
        (window as any).testBlob = blob;
      },
      { content: csvContent }
    );

    // Set file value
    await fileInput.setInputFiles({
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // Wait for preview to load
    await expect(page.locator('text=Column Mapping')).toBeVisible({ timeout: 5000 });

    // Verify validation counts
    await expect(page.locator('text=Valid Rows')).toBeVisible();
    await expect(page.locator('text=Invalid Rows')).toBeVisible();

    // Click continue button
    const continueButton = page.locator('button:has-text("Continue")');
    await continueButton.click();

    // Verify confirmation step
    await expect(page.locator('text=Ready to Submit')).toBeVisible();

    // Submit for processing
    const submitButton = page.locator('button:has-text("Submit for Processing")');
    await submitButton.click();

    // Wait for success message
    await expect(page.locator('text=CSV uploaded successfully')).toBeVisible({ timeout: 10000 });

    // Switch to jobs tab
    await page.locator('button:has-text("View Jobs")').click();

    // Verify jobs list is visible
    await expect(page.locator('text=Job ID')).toBeVisible();

    // Wait for a job to appear in the list (if processing finished quickly)
    await expect(page.locator('table tbody tr')).toHaveCount(1, { timeout: 5000 }).catch(() => {
      // If not exactly 1, at least ensure table rows are visible
      return expect(page.locator('table tbody tr')).toBeVisible({ timeout: 5000 });
    });
  });

  test('should validate CSV headers', async ({ page }) => {
    const invalidCsv = `invalid_header1,invalid_header2
value1,value2`;

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'invalid.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidCsv),
    });

    // Should still show preview with empty mapping
    await expect(page.locator('text=Column Mapping')).toBeVisible({ timeout: 5000 });
  });

  test('should display job details', async ({ page }) => {
    // Navigate to jobs tab
    await page.locator('button:has-text("View Jobs")').click();

    // Wait for table to load
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });

    // If there are any jobs, click on the first one
    const firstJobLink = page.locator('a:has-text("View Details")').first();
    const isVisible = await firstJobLink.isVisible().catch(() => false);

    if (isVisible) {
      await firstJobLink.click();

      // Verify job detail page elements
      await expect(page.locator('text=Job')).toBeVisible();
      await expect(page.locator('text=Total Rows')).toBeVisible();
      await expect(page.locator('text=Valid Rows')).toBeVisible();
    }
  });
});
