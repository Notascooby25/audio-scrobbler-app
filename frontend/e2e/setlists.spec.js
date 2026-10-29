import { test, expect } from '@playwright/test'

const gig = {
  id: 7,
  setlist_id: '63de4613',
  artist_name: 'The Lottery Winners',
  venue_name: 'HMV Empire',
  city: 'Coventry',
  country: 'England',
  event_date: '2025-11-25T20:00:00',
  tour_name: null,
  is_support_act: false,
  song_count: 2,
  notes: null,
  raw_data: { sets: { set: [{ song: [{ name: 'Burning House' }, { name: 'Worry' }] }] } },
}

const artists = [
  {
    artist_name: 'The Lottery Winners',
    count: 1,
    gigs: [
      {
        id: 7,
        setlist_id: '63de4613',
        date: '25 Nov 2025',
        event_date: gig.event_date,
        venue: 'HMV Empire',
        city: 'Coventry',
        country: 'England',
        is_support: false,
        song_count: 2,
      },
    ],
  },
]

// The app's service worker would take over fetches after the first load, and
// page.route can't see requests it makes, so keep it out of these tests
test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ accessToken: 'e2e-token' }))
  })
  // Mock the API in the browser; navigations still go to the Vite dev server
  await page.route('**/*', (route) => {
    const request = route.request()
    if (!['fetch', 'xhr'].includes(request.resourceType())) return route.continue()
    const { pathname } = new URL(request.url())
    if (pathname === '/setlists/stats/artists') return route.fulfill({ json: artists })
    if (pathname === '/setlists/attendances/7') return route.fulfill({ json: gig })
    if (pathname === '/setlists/attendances/7/bill') {
      return route.fulfill({ json: { acts: [], complete: true, capped: false } })
    }
    if (pathname === '/setlists/attendances') return route.fulfill({ json: [gig] })
    if (pathname === '/setlists/status') return route.fulfill({ json: { configured: true } })
    return route.fulfill({ json: [] })
  })
})

test.describe('set lists', () => {
  test('Back from a gig page restores the tab and expanded artist', async ({ page }) => {
    await page.goto('/setlists?tab=artists')
    await page.getByRole('button', { name: 'The Lottery Winners' }).click()
    await expect(page).toHaveURL(/open=The\+Lottery\+Winners/)

    await page.getByRole('button', { name: 'HMV Empire, Coventry' }).click()
    await expect(page).toHaveURL(/\/gigs\/7$/)
    await expect(page.getByRole('heading', { name: 'The Lottery Winners Setlist' })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(nav.getByRole('link', { name: 'Set Lists', exact: true })).toHaveClass(/nav-link-active/)

    await page.getByRole('button', { name: /back/i }).click()
    await expect(page).toHaveURL(/tab=artists&open=The\+Lottery\+Winners/)
    await expect(page.getByRole('tab', { name: 'Artists Seen' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('button', { name: 'HMV Empire, Coventry' })).toBeVisible()
  })

  test('a gig page loads directly and Back falls back to My Gigs', async ({ page }) => {
    await page.goto('/gigs/7')
    await expect(page.getByText('Burning House')).toBeVisible()
    await page.getByRole('button', { name: /back/i }).click()
    await expect(page).toHaveURL(/\/setlists$/)
    await expect(page.getByRole('heading', { name: 'All Gigs (1)' })).toBeVisible()
  })
  test('an invite from someone you follow adds the gig to My Gigs', async ({ page }) => {
    let added = false
    // Registered after the catch-all, so these win
    await page.route('**/setlists/invites', (route) =>
      route.fulfill({
        json: added
          ? []
          : [
              {
                id: 3,
                from_user: { user_id: 1, username: 'andy', display_name: 'Andy' },
                artist_name: 'Doves',
                venue_name: 'Rock City',
                city: 'Nottingham',
                country: 'UK',
                event_date: '2025-05-01T00:00:00',
                tour_name: null,
                song_count: 2,
                support_acts: [],
              },
            ],
      })
    )
    await page.route('**/setlists/invites/3/add', (route) => {
      added = true
      return route.fulfill({ json: { ...gig, id: 8, artist_name: 'Doves' } })
    })

    await page.goto('/setlists')
    const invites = page.getByRole('region', { name: 'Gig invites' })
    await expect(invites).toContainText('Andy says you were at Doves, Rock City, Nottingham on 1 May 2025')
    await invites.getByRole('button', { name: 'Add to my gigs' }).click()
    await expect(page.getByText('Added Doves to your gigs.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add to my gigs' })).toHaveCount(0)
  })
})
