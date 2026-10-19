
/* ================================
   THE GADGET HUB STORE
   Application Bootstrap & Main Logic
   ================================ */

import {
  isFirebaseInitialized,
  getCurrentUser,
  isAuthenticated,
  subscribeToAuthState,
  db,
  getDoc,
  doc,
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from './firebase.js';

import {
  showToast,
  showLoading,
  showEmptyState,
  showError,
  setButtonLoading,
  closeDropdown,
  toggleDropdown,
  escapeHtml,
  debounce
} from './ui.js';

/* ================================
   GLOBAL STATE
   ================================ */

let currentUser = null;
let appSettings = null;
let supportedCurrencies = [];
let selectedCurrency = 'USD';

/* ================================
   LIVE CURRENCY STATE
   ================================ */

let exchangeRates = {};
let exchangeRatesDate = null;
let exchangeRatesSource = 'fallback';

const CURRENCY_CACHE_KEY =
  'gadgetHubExchangeRates_v2';

const CURRENCY_CACHE_TTL =
  6 * 60 * 60 * 1000;

/*
 * Use a NEW key for explicit manual selection.
 * The old "selectedCurrency" value may have been
 * saved automatically or during earlier testing.
 * Do not treat that legacy value as manual choice.
 */
const SELECTED_CURRENCY_KEY =
  'gadgetHubManualCurrency_v2';

/*
 * Country results are intentionally NOT cached here.
 * Every fresh page initialization attempts to detect
 * the visitor's current public-IP country.
 */

const FALLBACK_EXCHANGE_RATES = {
  USD: 1.0,
  GBP: 0.79,
  EUR: 0.92,
  CAD: 1.36,
  AUD: 1.52,
  CNY: 7.24,
  JPY: 149.50,
  KRW: 1320.00,
  INR: 83.12,
  PKR: 278.50,
  BDT: 109.75,
  NPR: 132.95,
  AED: 3.67,
  SAR: 3.75,
  TRY: 32.15,
  MYR: 4.72,
  IDR: 15625.00,
  SGD: 1.34,
  THB: 35.80,
  ZAR: 18.65
};

/* ================================
   INITIALIZATION
   ================================ */

async function initializeApp() {
  console.log(
    '🚀 Initializing The Gadget Hub Store...'
  );

  if (!isFirebaseInitialized()) {
    console.warn(
      '⚠️ Firebase not initialized - some features may be limited'
    );

    showToast(
      'Some features may be limited due to connection issues',
      'warning',
      5000
    );
  } else {
    console.log('✅ Firebase ready');
  }

  setupAuthStateListener();

  await initializeGlobalFeatures();

  await initializePageSpecificFeatures();

  console.log('✅ Application initialized');
}

/* ================================
   AUTHENTICATION STATE
   ================================ */

function setupAuthStateListener() {
  subscribeToAuthState((user) => {
    currentUser = user;
    updateAuthUI();
    updateFavoritesBadge();
  });
}

function updateAuthUI() {
  const accountLink =
    document.querySelector('a[href*="account.html"]');

  if (accountLink && currentUser) {
    accountLink.setAttribute(
      'title',
      `Account: ${currentUser.email}`
    );
  }

  console.log(
    '🔐 Auth UI updated:',
    currentUser ? 'Signed in' : 'Signed out'
  );
}

/* ================================
   GLOBAL FEATURES
   ================================ */

async function initializeGlobalFeatures() {
  console.log('🌍 Initializing global features...');

  await initializeCurrencySelector();

  await loadSocialLinks();

  initializeNewsletterForm();

  updateFavoritesBadge();

  console.log('✅ Global features initialized');
}

/* ================================
   CURRENCY SELECTOR
   ================================ */

async function initializeCurrencySelector() {
  try {
    supportedCurrencies =
      await loadSupportedCurrencies();

    /*
     * Manual choice is honored only when saved
     * using the new manual-selection key.
     */
    selectedCurrency =
      await loadCurrencyPreference();

    await loadExchangeRates();

    ensureMobileCurrencySelector();

    populateCurrencyDropdown();

    setupCurrencySelector();

    updateCurrencyButton();

    console.log(
      `💱 Currency selector initialized: ${selectedCurrency}`
    );
  } catch (error) {
    console.error(
      'Error initializing currency selector:',
      error
    );

    selectedCurrency = 'USD';

    exchangeRates = {
      ...FALLBACK_EXCHANGE_RATES
    };

    exchangeRatesSource = 'fallback';

    ensureMobileCurrencySelector();

    populateCurrencyDropdownFallback();

    setupCurrencySelector();

    updateCurrencyButton();
  }
}

async function loadSupportedCurrencies() {
  if (!isFirebaseInitialized()) {
    return getDefaultCurrencies();
  }

  try {
    const settingsDoc =
      await getDoc(doc(db, 'settings', 'global'));

    if (settingsDoc.exists()) {
      const settings = settingsDoc.data();

      appSettings = settings;

      if (
        settings.supportedCurrencies &&
        Array.isArray(settings.supportedCurrencies)
      ) {
        return settings.supportedCurrencies;
      }
    }

    return getDefaultCurrencies();
  } catch (error) {
    console.error(
      'Error loading currencies from Firebase:',
      error
    );

    return getDefaultCurrencies();
  }
}

function getDefaultCurrencies() {
  return [
    { code: 'USD', name: 'US Dollar', symbol: '$', country: 'United States' },
    { code: 'GBP', name: 'Pound Sterling', symbol: '£', country: 'United Kingdom' },
    { code: 'EUR', name: 'Euro', symbol: '€', country: 'Eurozone' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', country: 'Canada' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', country: 'Australia' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', country: 'China' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', country: 'Japan' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩', country: 'South Korea' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', country: 'India' },
    { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', country: 'Pakistan' },
    { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', country: 'Bangladesh' },
    { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs', country: 'Nepal' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', country: 'UAE' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', country: 'Saudi Arabia' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺', country: 'Turkey' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', country: 'Malaysia' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', country: 'Indonesia' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', country: 'Singapore' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿', country: 'Thailand' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', country: 'South Africa' }
  ];
}

/* ================================
   COUNTRY AUTO DETECTION
   ================================ */

/*
 * Detect country from public IP.
 *
 * Primary provider: ipapi.co
 * Backup provider: ipwho.is
 *
 * No country cache is used. A stale country
 * result must not override the current visit.
 */
async function detectCountryFromIP() {
  const providers = [
    {
      url: 'https://ipapi.co/json/',
      parse: data => data?.country_code
    },
    {
      url: 'https://ipwho.is/',
      parse: data =>
        data?.success === true
          ? data.country_code
          : null
    }
  ];

  for (const provider of providers) {
    let timer;

    try {
      const controller = new AbortController();

      timer = setTimeout(() => {
        controller.abort();
      }, 4000);

      const response = await fetch(provider.url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json'
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(
          `Country API returned ${response.status}`
        );
      }

      const data = await response.json();

      const country = String(
        provider.parse(data) || ''
      ).trim().toUpperCase();

      if (!/^[A-Z]{2}$/.test(country)) {
        throw new Error(
          'Invalid country code returned by API'
        );
      }

      console.log(
        '🌍 Country detected by IP:',
        country,
        'Source:',
        provider.url
      );

      return country;
    } catch (error) {
      console.warn(
        'Country detection provider failed:',
        provider.url,
        error
      );
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  console.error(
    'Country detection failed on all providers.'
  );

  return null;
}

/*
 * Map supported country codes to store currencies.
 * Countries with unsupported local currencies use
 * the configured default instead of a guessed currency.
 */
function currencyFromDetectedCountry(countryCode) {
  if (!countryCode) {
    return null;
  }

  const countryCurrencyMap = {
    US: 'USD',
    GB: 'GBP',
    CA: 'CAD',
    AU: 'AUD',
    CN: 'CNY',
    JP: 'JPY',
    KR: 'KRW',
    IN: 'INR',
    PK: 'PKR',
    BD: 'BDT',
    NP: 'NPR',
    AE: 'AED',
    SA: 'SAR',
    TR: 'TRY',
    MY: 'MYR',
    ID: 'IDR',
    SG: 'SGD',
    TH: 'THB',
    ZA: 'ZAR'
  };

  const euroCountries = [
    'AT',
    'BE',
    'CY',
    'DE',
    'EE',
    'ES',
    'FI',
    'FR',
    'GR',
    'HR',
    'IE',
    'IT',
    'LT',
    'LU',
    'LV',
    'MT',
    'NL',
    'PT',
    'SI',
    'SK'
  ];

  const country =
    String(countryCode).trim().toUpperCase();

  if (countryCurrencyMap[country]) {
    return countryCurrencyMap[country];
  }

  if (euroCountries.includes(country)) {
    return 'EUR';
  }

  return null;
}

/*
 * Browser language is deliberately NOT used to
 * determine country. A language such as en-US does
 * not prove the visitor is physically in the USA.
 */

/* ================================
   CURRENCY VALIDATION
   ================================ */

function isSupportedCurrency(currencyCode) {
  return supportedCurrencies.some(
    currency =>
      String(currency.code).toUpperCase() ===
      String(currencyCode).toUpperCase()
  );
}

/*
 * Currency selection priority:
 *
 * 1. Explicit manual selection saved with the new key
 * 2. Current IP country detection
 * 3. Configured store default currency
 * 4. USD fallback
 *
 * The legacy "selectedCurrency" key is intentionally
 * ignored because it may contain an old automatic
 * choice or a test value.
 */
async function loadCurrencyPreference() {
  try {
    const savedCurrency =
      localStorage.getItem(SELECTED_CURRENCY_KEY);

    if (
      savedCurrency &&
      isSupportedCurrency(savedCurrency.toUpperCase())
    ) {
      console.log(
        '💱 Using manually selected currency:',
        savedCurrency.toUpperCase()
      );

      return savedCurrency.toUpperCase();
    }
  } catch (error) {
    console.warn(
      'Unable to read manual currency preference:',
      error
    );
  }

  const detectedCountry =
    await detectCountryFromIP();

  const detectedCurrency =
    currencyFromDetectedCountry(detectedCountry);

  if (
    detectedCurrency &&
    isSupportedCurrency(detectedCurrency)
  ) {
    console.log(
      '💱 Automatic country currency:',
      detectedCountry,
      detectedCurrency
    );

    return detectedCurrency;
  }

  /*
   * If country detection fails, do not guess using
   * browser language or a stale country result.
   */
  if (
    appSettings?.defaultCurrency &&
    isSupportedCurrency(appSettings.defaultCurrency)
  ) {
    console.warn(
      'Country unknown. Using configured default:',
      appSettings.defaultCurrency
    );

    return appSettings.defaultCurrency.toUpperCase();
  }

  console.warn(
    'Country unknown. Using USD fallback.'
  );

  return 'USD';
}

/* ================================
   LIVE EXCHANGE RATES
   ================================ */

async function loadExchangeRates() {
  exchangeRates = {
    ...FALLBACK_EXCHANGE_RATES
  };

  exchangeRatesSource = 'fallback';

  try {
    const cached =
      localStorage.getItem(CURRENCY_CACHE_KEY);

    if (cached) {
      const parsed = JSON.parse(cached);

      if (
        parsed &&
        parsed.rates &&
        parsed.timestamp &&
        Date.now() - parsed.timestamp <
          CURRENCY_CACHE_TTL
      ) {
        exchangeRates = {
          ...FALLBACK_EXCHANGE_RATES,
          ...parsed.rates,
          USD: 1
        };

        exchangeRatesDate = parsed.date || null;

        exchangeRatesSource = 'live-cache';

        console.log(
          '💱 Using cached live exchange rates:',
          exchangeRatesDate || 'latest'
        );

        return exchangeRates;
      }
    }
  } catch (error) {
    console.warn(
      'Unable to read exchange-rate cache:',
      error
    );
  }

  const currencyCodes = getDefaultCurrencies()
    .map(currency => currency.code)
    .filter(code => code !== 'USD');

  const quotes = currencyCodes.join(',');

  const endpoint =
    `https://api.frankfurter.dev/v2/rates?base=USD&quotes=${encodeURIComponent(quotes)}`;

  let timer;

  try {
    const controller = new AbortController();

    timer = setTimeout(() => {
      controller.abort();
    }, 5000);

    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(
        `Exchange-rate request failed: ${response.status}`
      );
    }

    const data = await response.json();

    const liveRates = {
      USD: 1
    };

    if (Array.isArray(data)) {
      data.forEach(item => {
        if (
          item &&
          item.quote &&
          Number.isFinite(Number(item.rate))
        ) {
          liveRates[
            String(item.quote).toUpperCase()
          ] = Number(item.rate);
        }
      });
    }

    if (
      data &&
      !Array.isArray(data) &&
      data.rates &&
      typeof data.rates === 'object'
    ) {
      Object.entries(data.rates).forEach(
        ([code, rate]) => {
          if (Number.isFinite(Number(rate))) {
            liveRates[code.toUpperCase()] = Number(rate);
          }
        }
      );
    }

    exchangeRates = {
      ...FALLBACK_EXCHANGE_RATES,
      ...liveRates,
      USD: 1
    };

    exchangeRatesDate =
      Array.isArray(data)
        ? data[0]?.date || null
        : data?.date || null;

    exchangeRatesSource = 'live';

    try {
      localStorage.setItem(
        CURRENCY_CACHE_KEY,
        JSON.stringify({
          rates: exchangeRates,
          date: exchangeRatesDate,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.warn(
        'Unable to cache exchange rates'
      );
    }

    console.log(
      '💱 Latest exchange rates loaded:',
      exchangeRatesDate || 'latest published rates'
    );

    return exchangeRates;
  } catch (error) {
    console.warn(
      'Live exchange rates unavailable. Using fallback rates:',
      error
    );

    exchangeRates = {
      ...FALLBACK_EXCHANGE_RATES
    };

    exchangeRatesSource = 'fallback';

    return exchangeRates;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function getExchangeRate(currencyCode = 'USD') {
  const code = String(currencyCode).toUpperCase();

  const rate = exchangeRates[code];

  if (Number.isFinite(Number(rate))) {
    return Number(rate);
  }

  return 1;
}

export function convertCurrency(
  basePrice,
  targetCurrency = selectedCurrency
) {
  const numericPrice = Number(basePrice);

  if (!Number.isFinite(numericPrice)) {
    return 0;
  }

  return numericPrice * getExchangeRate(targetCurrency);
}

/* ================================
   CURRENCY DROPDOWN
   ================================ */

function populateCurrencyDropdown() {
  const dropdowns = document.querySelectorAll(
    '#currencyDropdown, #mobileCurrencyDropdown'
  );

  if (!dropdowns.length) {
    return;
  }

  const html = supportedCurrencies
    .map(currency => `
      <button
        class="currency-option ${
          currency.code === selectedCurrency ? 'active' : ''
        }"
        data-currency="${escapeHtml(currency.code)}"
        role="menuitem"
        type="button"
      >
        <div class="currency-option-label">
          <span class="currency-option-name">
            ${escapeHtml(currency.name)}
          </span>
          <span class="currency-option-code">
            ${escapeHtml(currency.code)}
            (${escapeHtml(currency.symbol)})
          </span>
        </div>
      </button>
    `)
    .join('');

  dropdowns.forEach(dropdown => {
    dropdown.innerHTML = html;

    dropdown.querySelectorAll('.currency-option')
      .forEach(option => {
        option.addEventListener('click', () => {
          selectCurrency(option.dataset.currency);
        });
      });
  });
}

function populateCurrencyDropdownFallback() {
  const dropdowns = document.querySelectorAll(
    '#currencyDropdown, #mobileCurrencyDropdown'
  );

  if (!dropdowns.length) {
    return;
  }

  const html = getDefaultCurrencies()
    .map(currency => `
      <button
        class="currency-option ${
          currency.code === selectedCurrency ? 'active' : ''
        }"
        data-currency="${escapeHtml(currency.code)}"
        role="menuitem"
        type="button"
      >
        <div class="currency-option-label">
          <span class="currency-option-name">
            ${escapeHtml(currency.name)}
          </span>
          <span class="currency-option-code">
            ${escapeHtml(currency.code)}
            (${escapeHtml(currency.symbol)})
          </span>
        </div>
      </button>
    `)
    .join('');

  dropdowns.forEach(dropdown => {
    dropdown.innerHTML = html;

    dropdown.querySelectorAll('.currency-option')
      .forEach(option => {
        option.addEventListener('click', () => {
          selectCurrency(option.dataset.currency);
        });
      });
  });
}

/* ================================
   MOBILE CURRENCY SELECTOR
   ================================ */

function ensureMobileCurrencySelector() {
  try {
    if (
      document.getElementById('mobileCurrencySelector')
    ) {
      return;
    }

    const sourceSelector =
      document.getElementById('currencySelector');

    const mobileMenuContent =
      document.querySelector(
        '#mobileMenu .mobile-menu-content'
      );

    if (!sourceSelector || !mobileMenuContent) {
      return;
    }

    const mobileSelector =
      sourceSelector.cloneNode(true);

    const mobileButton =
      mobileSelector.querySelector('#currencyBtn');

    const mobileDropdown =
      mobileSelector.querySelector('#currencyDropdown');

    const mobileSelectedCurrency =
      mobileSelector.querySelector('#selectedCurrency');

    if (
      !mobileButton ||
      !mobileDropdown ||
      !mobileSelectedCurrency
    ) {
      return;
    }

    mobileSelector.id = 'mobileCurrencySelector';
    mobileButton.id = 'mobileCurrencyBtn';
    mobileDropdown.id = 'mobileCurrencyDropdown';
    mobileSelectedCurrency.id = 'mobileSelectedCurrency';

    mobileButton.dataset.dropdownToggle =
      'mobileCurrencyDropdown';

    mobileSelector
      .querySelectorAll('[data-currency-initialized]')
      .forEach(element => {
        delete element.dataset.currencyInitialized;
      });

    mobileMenuContent.appendChild(mobileSelector);

    console.log(
      '📱 Mobile currency selector initialized'
    );
  } catch (error) {
    console.warn(
      'Unable to create mobile currency selector:',
      error
    );
  }
}

/* ================================
   CURRENCY SELECTOR SETUP
   ================================ */

function setupCurrencySelector() {
  const selectors = [
    {
      buttonId: 'currencyBtn',
      dropdownId: 'currencyDropdown'
    },
    {
      buttonId: 'mobileCurrencyBtn',
      dropdownId: 'mobileCurrencyDropdown'
    }
  ];

  selectors.forEach(({ buttonId, dropdownId }) => {
    const currencyBtn =
      document.getElementById(buttonId);

    const currencyDropdown =
      document.getElementById(dropdownId);

    if (!currencyBtn || !currencyDropdown) {
      return;
    }

    if (
      currencyBtn.dataset.currencyInitialized === 'true'
    ) {
      return;
    }

    currencyBtn.dataset.currencyInitialized = 'true';
    currencyBtn.dataset.dropdownToggle = dropdownId;

    currencyBtn.addEventListener('click', event => {
      event.stopPropagation();

      closeAllCurrencyDropdowns(dropdownId);

      toggleDropdown(dropdownId);

      currencyBtn.setAttribute(
        'aria-expanded',
        currencyDropdown.classList.contains('active')
          ? 'true'
          : 'false'
      );
    });
  });

  document
    .querySelectorAll(
      '#currencyDropdown, #mobileCurrencyDropdown'
    )
    .forEach(dropdown => {
      dropdown.addEventListener('click', event => {
        const option =
          event.target.closest('.currency-option');

        if (option) {
          event.stopPropagation();
        }
      });
    });
}

function closeAllCurrencyDropdowns(
  exceptDropdownId = ''
) {
  [
    'currencyDropdown',
    'mobileCurrencyDropdown'
  ].forEach(id => {
    if (id === exceptDropdownId) {
      return;
    }

    const dropdown = document.getElementById(id);

    if (dropdown) {
      dropdown.classList.remove('active');
    }
  });

  [
    'currencyBtn',
    'mobileCurrencyBtn'
  ].forEach(id => {
    const button = document.getElementById(id);

    if (!button) {
      return;
    }

    const dropdownId = button.dataset.dropdownToggle;

    if (dropdownId !== exceptDropdownId) {
      button.setAttribute('aria-expanded', 'false');
    }
  });
}

function updateCurrencyButton() {
  document
    .querySelectorAll(
      '#selectedCurrency, #mobileSelectedCurrency'
    )
    .forEach(element => {
      element.textContent = selectedCurrency;
    });
}

/* ================================
   MANUAL CURRENCY SELECTION
   ================================ */

async function selectCurrency(currencyCode) {
  const normalizedCurrency =
    String(currencyCode).toUpperCase();

  if (!isSupportedCurrency(normalizedCurrency)) {
    console.warn(
      'Unsupported currency selected:',
      currencyCode
    );

    return;
  }

  selectedCurrency = normalizedCurrency;

  /*
   * Save only explicit user selections.
   * Automatic detection never writes this key.
   */
  try {
    localStorage.setItem(
      SELECTED_CURRENCY_KEY,
      normalizedCurrency
    );
  } catch (error) {
    console.warn(
      'Cannot save manual currency preference:',
      error
    );
  }

  if (
    !Number.isFinite(
      Number(exchangeRates[normalizedCurrency])
    )
  ) {
    await loadExchangeRates();
  }

  updateCurrencyButton();

  populateCurrencyDropdown();

  closeAllCurrencyDropdowns();

  const currency = supportedCurrencies.find(
    item => item.code === normalizedCurrency
  );

  showToast(
    `Currency changed to ${
      currency ? currency.name : normalizedCurrency
    }`,
    'success'
  );

  document.dispatchEvent(
    new CustomEvent('currencyChanged', {
      detail: {
        currency: normalizedCurrency
      }
    })
  );

  console.log(
    '💱 Manual currency selected:',
    normalizedCurrency
  );
}

export function getCurrentCurrency() {
  return selectedCurrency;
}

/* ================================
   SOCIAL LINKS
   ================================ */

async function loadSocialLinks() {
  const socialContainer =
    document.getElementById('socialLinks');

  const footerSocialContainer =
    document.getElementById('footerSocial');

  if (!socialContainer && !footerSocialContainer) {
    return;
  }

  if (!isFirebaseInitialized()) {
    console.warn(
      'Cannot load social links - Firebase not initialized'
    );

    return;
  }

  try {
    const settingsDoc = await getDoc(
      doc(db, 'settings', 'global')
    );

    if (!settingsDoc.exists()) {
      if (socialContainer) {
        socialContainer.innerHTML =
          '<p style="color: var(--color-text-tertiary);">No social links configured</p>';
      }

      return;
    }

    const settings = settingsDoc.data();

    renderSocialLinks(settings.socialLinks || {});

    console.log('✅ Social links loaded');
  } catch (error) {
    console.error(
      'Error loading social links:',
      error
    );

    if (socialContainer) {
      socialContainer.innerHTML =
        '<p style="color: var(--color-text-muted);">Could not load social links</p>';
    }
  }
}

function renderSocialLinks(socialLinks) {
  const socialContainer =
    document.getElementById('socialLinks');

  const footerSocialContainer =
    document.getElementById('footerSocial');

  const footerFollowLinks =
    document.getElementById('footerFollowLinks');

  const platforms = [
    { name: 'Facebook', icon: 'facebook', key: 'facebook' },
    { name: 'Instagram', icon: 'instagram', key: 'instagram' },
    { name: 'YouTube', icon: 'youtube', key: 'youtube' },
    { name: 'TikTok', icon: 'tiktok', key: 'tiktok' }
  ];

  const icons = {
    facebook:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',

    instagram:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.069 4.849-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.227-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',

    youtube:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',

    tiktok:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>'
  };

  if (socialContainer) {
    const html = platforms
      .filter(platform => socialLinks[platform.key])
      .map(platform => `
        <a
          href="${escapeHtml(socialLinks[platform.key])}"
          class="social-link"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${platform.name}"
        >
          ${icons[platform.icon]}
        </a>
      `)
      .join('');

    socialContainer.innerHTML =
      html ||
      '<p style="color: var(--color-text-tertiary);">No social links configured</p>';
  }

  if (footerSocialContainer) {
    footerSocialContainer.innerHTML = platforms
      .filter(platform => socialLinks[platform.key])
      .map(platform => `
        <a
          href="${escapeHtml(socialLinks[platform.key])}"
          class="footer-social-link"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${platform.name}"
        >
          ${icons[platform.icon]}
        </a>
      `)
      .join('');
  }

  if (footerFollowLinks) {
    footerFollowLinks
      .querySelectorAll('a[data-social]')
      .forEach(link => {
        const platform = link.dataset.social;

        if (socialLinks[platform]) {
          link.href = socialLinks[platform];
        } else {
          link.style.display = 'none';
        }
      });
  }
}

/* ================================
   NEWSLETTER
   ================================ */

function initializeNewsletterForm() {
  const newsletterForm =
    document.getElementById('newsletterForm');

  if (!newsletterForm) {
    return;
  }

  newsletterForm.addEventListener(
    'submit',
    handleNewsletterSubmit
  );

  console.log('✅ Newsletter form initialized');
}

async function handleNewsletterSubmit(e) {
  e.preventDefault();

  const emailInput =
    document.getElementById('newsletterEmail');

  const submitBtn =
    document.getElementById('newsletterSubmitBtn');

  if (!emailInput || !submitBtn) {
    return;
  }

  const email = emailInput.value.trim();

  if (!email || !isValidEmail(email)) {
    showToast(
      'Please enter a valid email address',
      'error'
    );

    emailInput.focus();

    return;
  }

  if (!isFirebaseInitialized()) {
    showToast(
      'Service unavailable. Please try again later.',
      'error'
    );

    return;
  }

  setButtonLoading(submitBtn, true);

  try {
    await addDoc(
      collection(db, 'newsletterSubscribers'),
      {
        email,
        subscribedAt: serverTimestamp(),
        source: 'homepage',
        active: true
      }
    );

    showToast(
      '✅ Successfully subscribed to newsletter!',
      'success'
    );

    emailInput.value = '';
  } catch (error) {
    console.error(
      'Newsletter subscription error:',
      error
    );

    if (error.code === 'permission-denied') {
      showToast(
        'Subscription temporarily unavailable',
        'error'
      );
    } else {
      showToast(
        'Failed to subscribe. Please try again.',
        'error'
      );
    }
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ================================
   FAVORITES BADGE
   ================================ */

async function updateFavoritesBadge() {
  const badge =
    document.getElementById('favoritesBadge');

  if (!badge) {
    return;
  }

  if (!isAuthenticated()) {
    badge.textContent = '0';
    return;
  }

  // Existing placeholder implementation.
  badge.textContent = '0';
}

/* ================================
   PAGE-SPECIFIC INITIALIZATION
   ================================ */

async function initializePageSpecificFeatures() {
  const path = window.location.pathname;

  const page =
    path.substring(path.lastIndexOf('/') + 1) ||
    'index.html';

  console.log(`📄 Current page: ${page}`);

  switch (page) {
    case 'index.html':
    case '':
      await initializeHomePage();
      break;

    case 'shop.html':
      console.log(
        'Shop page - will be initialized by products module'
      );
      break;

    case 'product.html':
      console.log(
        'Product page - will be initialized by products module'
      );
      break;

    case 'favorites.html':
      console.log(
        'Favorites page - will be initialized by favorites module'
      );
      break;

    case 'account.html':
      console.log(
        'Account page - will be initialized by auth module'
      );
      break;

    case 'trending.html':
      console.log(
        'Trending page - will be initialized by products module'
      );
      break;

    case 'deals.html':
      console.log(
        'Deals page - will be initialized by products module'
      );
      break;

    case 'categories.html':
      console.log(
        'Categories page - will be initialized by categories module'
      );
      break;

    default:
      console.log('Unknown page');
  }

  updateActiveNavLink(page);
}

async function initializeHomePage() {
  console.log(
    '🏠 Initializing homepage features...'
  );

  try {
    const categoriesModule =
      await import('./categories.js');

    if (
      categoriesModule.initializeHomepageCategories
    ) {
      await categoriesModule
        .initializeHomepageCategories();
    }

    const productsModule =
      await import('./products.js');

    if (
      productsModule.initializeHomepageProducts
    ) {
      await productsModule
        .initializeHomepageProducts();
    }

    console.log(
      '✅ Homepage initialization complete'
    );
  } catch (error) {
    console.error(
      'Error initializing homepage modules:',
      error
    );
  }
}

function updateActiveNavLink(currentPage) {
  const navLinks = document.querySelectorAll(
    '.nav-link, .mobile-nav-link'
  );

  navLinks.forEach(link => {
    link.classList.remove('active');

    link.removeAttribute('aria-current');

    const href = link.getAttribute('href');

    if (!href) {
      return;
    }

    const linkPage =
      href.substring(href.lastIndexOf('/') + 1);

    if (
      linkPage === currentPage ||
      (currentPage === '' && linkPage === 'index.html') ||
      (currentPage === 'index.html' && linkPage === 'index.html')
    ) {
      link.classList.add('active');

      link.setAttribute('aria-current', 'page');
    }
  });
}

/* ================================
   GLOBAL ERROR HANDLING
   ================================ */

window.addEventListener('error', event => {
  console.error('Global error:', event.error);
});

window.addEventListener(
  'unhandledrejection',
  event => {
    console.error(
      'Unhandled promise rejection:',
      event.reason
    );
  }
);

/* ================================
   START APPLICATION
   ================================ */

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializeApp
  );
} else {
  initializeApp();
}

export {
  selectedCurrency,
  appSettings
};
