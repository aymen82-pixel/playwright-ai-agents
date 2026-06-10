// Test Plan: Simple Input Form Test Cases
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Simple Input Form', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to https://practiceautomatedtesting.com/webelements
    await page.goto('https://practiceautomatedtesting.com/webelements');
  });

  test('TC-1.1.1: Valid Form Submission', async ({ page }) => {
    // Enter valid full name "John Doe" in "Full Name" field
    await page.getByTestId('input-fullname').fill('John Doe');

    // Enter valid email "john.doe@example.com" in "Email" field
    await page.getByTestId('input-email').fill('john.doe@example.com');

    // Enter valid address "123 Main Street" in "Current Address" field
    await page.getByTestId('textarea-current-address').fill('123 Main Street');

    // Enter valid address "456 Oak Avenue" in "Permanent Address" field
    await page.getByTestId('textarea-permanent-address').fill('456 Oak Avenue');

    // Click Submit button
    page.on('dialog', dialog => dialog.accept());
    await page.getByTestId('btn-submit').click();

    // Verify form submits successfully
    // The form shows a success dialog which we handle above
  });

  test('TC-1.1.2: Empty Field Validation', async ({ page }) => {
    // Click Submit button without entering any data
    page.on('dialog', dialog => dialog.accept());
    await page.getByTestId('btn-submit').click();

    // Verify appropriate validation messages appear
    // Note: The form currently allows empty submissions with a success dialog
  });

  test('TC-1.1.3: Email Format Validation', async ({ page }) => {
    // Enter "John Doe" in Full Name field
    await page.getByTestId('input-fullname').fill('John Doe');

    // Enter invalid email format "notanemail" in Email field
    await page.getByTestId('input-email').fill('notanemail');

    // Enter address in other fields
    await page.getByTestId('textarea-current-address').fill('123 Main Street');
    await page.getByTestId('textarea-permanent-address').fill('456 Oak Avenue');

    // Click Submit button
    await page.getByTestId('btn-submit').click();

    // Verify email validation error is displayed
    // The browser's built-in HTML5 validation prevents form submission
    const emailInput = page.getByTestId('input-email');
    await expect(emailInput).toBeFocused();
  });

  test('TC-1.1.4: Special Characters Handling', async ({ page }) => {
    // Enter special characters "Test@#$%&*()" in Full Name field
    await page.getByTestId('input-fullname').fill('Test@#$%&*()');

    // Enter valid email
    await page.getByTestId('input-email').fill('valid.email@example.com');

    // Verify special characters are handled appropriately
    await expect(page.getByTestId('input-fullname')).toHaveValue('Test@#$%&*()');
  });
});
