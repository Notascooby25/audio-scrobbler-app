import { test, expect } from '@playwright/test'

// The Reports page renders its DateRangeSelector independent of an authenticated
// session, so these specs exercise the selector's UI behaviour without requiring
// the full backend/database stack. Data-refresh behaviour against live API
// responses is covered by the Vitest integration tests in AnalyticsPages.test.jsx
// and is better verified end-to-end against the full docker-compose stack.

test.describe('date filtering', () => {
  test('defaults to the last 7 days preset', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.getByRole('combobox', { name: 'Range' })).toHaveValue('last.week')
    await expect(page.getByLabel('Start date')).not.toBeVisible()
    await expect(page.getByLabel('End date')).not.toBeVisible()
  })

  test('reveals custom start/end date inputs when custom range is selected', async ({ page }) => {
    await page.goto('/reports')

    await page.getByRole('combobox', { name: 'Range' }).selectOption('custom')

    await expect(page.getByLabel('Start date')).toBeVisible()
    await expect(page.getByLabel('End date')).toBeVisible()
  })

  test('hides custom date inputs again when switching back to a preset', async ({ page }) => {
    await page.goto('/reports')

    await page.getByRole('combobox', { name: 'Range' }).selectOption('custom')
    await expect(page.getByLabel('Start date')).toBeVisible()

    await page.getByRole('combobox', { name: 'Range' }).selectOption('last.month')

    await expect(page.getByLabel('Start date')).not.toBeVisible()
    await expect(page.getByLabel('End date')).not.toBeVisible()
  })

  test('toggles the compare-to-previous-period checkbox', async ({ page }) => {
    await page.goto('/reports')

    const compareCheckbox = page.getByLabel('Compare to previous period')
    await expect(compareCheckbox).not.toBeChecked()

    await compareCheckbox.check()
    await expect(compareCheckbox).toBeChecked()
  })
})
