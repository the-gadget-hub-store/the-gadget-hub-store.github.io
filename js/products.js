
/* ================================
   THE GADGET HUB STORE
   Products Module
   AliExpress-Inspired Product Cards
   Premium Skeleton Shimmer Edition
   ================================ */

import {
  isFirebaseInitialized,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  isAuthenticated,
  getUserId,
  Timestamp
} from './firebase.js';

import {
  showToast,
  showLoading,
  showEmptyState,
  showError,
  escapeHtml
} from './ui.js';

import {
  getCurrentCurrency,
  convertCurrency
} from './app.js';

/* ================================
   CONSTANTS
   ================================ */

const PLACEHOLDER_IMAGE =
  'assets/images/placeholder.jpg';

const DEFAULT_PRODUCT_TITLE =
  'Untitled Product';

const DEFAULT_PRODUCT_CATEGORY =
  'Gadgets';

const SKELETON_CARD_COUNT = 8;

/* ================================
   SAFE VALUE HELPERS
   ================================ */

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  );
}

function safeText(value, fallback = '') {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  return String(value);
}

function getSafeExternalUrl(value) {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(
      String(value),
      window.location.href
    );

    if (
      url.protocol !== 'https:' &&
      url.protocol !== 'http:'
    ) {
      return '';
    }

    return escapeHtml(url.href);
  } catch (error) {
    return '';
  }
}

function getProductImage(product) {
  const image =
    product.thumbnail ||
    (
      Array.isArray(product.images)
        ? product.images.find(
            (item) =>
              typeof item === 'string' &&
              item.trim()
          )
        : ''
    ) ||
    PLACEHOLDER_IMAGE;

  return safeText(
    image,
    PLACEHOLDER_IMAGE
  );
}

/* ================================
   CURRENCY FORMATTING
   ================================ */

function formatPrice(
  price,
  currency = 'USD'
) {
  const numericPrice =
    toNumber(price, 0);

  try {
    const zeroDecimalCurrencies = [
      'JPY',
      'KRW'
    ];

    const fractionDigits =
      zeroDecimalCurrencies.includes(
        currency
      )
        ? 0
        : 2;

    return new Intl.NumberFormat(
      'en-US',
      {
        style: 'currency',
        currency,
        minimumFractionDigits:
          fractionDigits,
        maximumFractionDigits:
          fractionDigits
      }
    ).format(numericPrice);
  } catch (error) {
    console.error(
      'Error formatting price:',
      error
    );

    return `${currency} ${numericPrice.toFixed(2)}`;
  }
}

export function getFormattedPrice(
  basePrice,
  targetCurrency = null
) {
  const currency =
    targetCurrency ||
    getCurrentCurrency();

  const convertedPrice =
    convertCurrency(
      toNumber(basePrice),
      currency
    );

  return formatPrice(
    convertedPrice,
    currency
  );
}

/* ================================
   SKELETON LOADING CARDS
   ================================ */

/**
 * Build a temporary product-card skeleton.
 *
 * The CSS shimmer animation is provided by
 * css/animations.css.
 */
function renderSkeletonCard(index) {
  return `
    <article
      class="product-card skeleton-card"
      aria-hidden="true"
      data-skeleton-index="${index}"
    >
      <div
        class="skeleton-image skeleton-shimmer"
      ></div>

      <div class="skeleton-card-content">

        <div
          class="skeleton skeleton-category"
        ></div>

        <div
          class="skeleton skeleton-title"
        ></div>

        <div
          class="skeleton skeleton-text"
        ></div>

        <div
          class="skeleton skeleton-rating"
        ></div>

        <div
          class="skeleton skeleton-price"
        ></div>

        <div
          class="skeleton skeleton-button"
        ></div>

      </div>
    </article>
  `;
}

function renderSkeletonGrid(
  container,
  count = SKELETON_CARD_COUNT
) {
  if (!container) {
    return;
  }

  const safeCount = clamp(
    Math.floor(toNumber(count, 8)),
    1,
    16
  );

  container.classList.add('is-loading');

  container.setAttribute(
    'aria-busy',
    'true'
  );

  container.innerHTML = Array.from(
    { length: safeCount },
    (_, index) =>
      renderSkeletonCard(index + 1)
  ).join('');
}

function finishGridLoading(container) {
  if (!container) {
    return;
  }

  container.classList.remove('is-loading');

  container.setAttribute(
    'aria-busy',
    'false'
  );
}

/* ================================
   PRODUCT LOADING
   ================================ */

export async function loadProducts() {
  if (!isFirebaseInitialized()) {
    throw new Error(
      'Firebase not initialized'
    );
  }

  try {
    const productsCollection =
      collection(db, 'products');

    const querySnapshot =
      await getDocs(productsCollection);

    const products = [];

    querySnapshot.forEach(
      (productDoc) => {
        products.push({
          id: productDoc.id,
          ...productDoc.data()
        });
      }
    );

    console.log(
      `Loaded ${products.length} products`
    );

    return products;
  } catch (error) {
    console.error(
      'Error loading products:',
      error
    );

    throw error;
  }
}

export async function loadProductsByFilter(
  field,
  value,
  maxResults = 50
) {
  if (!isFirebaseInitialized()) {
    throw new Error(
      'Firebase not initialized'
    );
  }

  try {
    const productsCollection =
      collection(db, 'products');

    const productsQuery = query(
      productsCollection,
      where(field, '==', value),
      limit(maxResults)
    );

    const querySnapshot =
      await getDocs(productsQuery);

    const products = [];

    querySnapshot.forEach(
      (productDoc) => {
        products.push({
          id: productDoc.id,
          ...productDoc.data()
        });
      }
    );

    console.log(
      `Loaded ${products.length} products where ${field}=${value}`
    );

    return products;
  } catch (error) {
    console.error(
      'Error loading filtered products:',
      error
    );

    throw error;
  }
}

export async function loadTrendingProducts(
  maxResults = 8
) {
  try {
    return await loadProductsByFilter(
      'trending',
      true,
      maxResults
    );
  } catch (error) {
    console.error(
      'Error loading trending products:',
      error
    );

    return [];
  }
}

export async function loadFeaturedProducts(
  maxResults = 8
) {
  try {
    return await loadProductsByFilter(
      'featured',
      true,
      maxResults
    );
  } catch (error) {
    console.error(
      'Error loading featured products:',
      error
    );

    return [];
  }
}

export async function loadProductsByCategory(
  categoryId,
  maxResults = 50
) {
  try {
    return await loadProductsByFilter(
      'categoryId',
      categoryId,
      maxResults
    );
  } catch (error) {
    console.error(
      'Error loading products by category:',
      error
    );

    return [];
  }
}

export async function loadProductById(
  productId
) {
  if (!isFirebaseInitialized()) {
    throw new Error(
      'Firebase not initialized'
    );
  }

  if (!productId) {
    throw new Error(
      'Product ID is required'
    );
  }

  try {
    const productDocument = await getDoc(
      doc(
        db,
        'products',
        productId
      )
    );

    if (!productDocument.exists()) {
      throw new Error(
        'Product not found'
      );
    }

    return {
      id: productDocument.id,
      ...productDocument.data()
    };
  } catch (error) {
    console.error(
      'Error loading product:',
      error
    );

    throw error;
  }
}

export async function loadDealProducts(
  maxResults = 8
) {
  if (!isFirebaseInitialized()) {
    return [];
  }

  try {
    const productsCollection =
      collection(db, 'products');

    const dealsQuery = query(
      productsCollection,
      where('discount', '>', 0),
      orderBy('discount', 'desc'),
      limit(maxResults)
    );

    const querySnapshot =
      await getDocs(dealsQuery);

    const products = [];
    const now = new Date();

    querySnapshot.forEach(
      (productDoc) => {
        const data =
          productDoc.data();

        let isValidDeal = true;

        if (data.dealExpiration) {
          let expirationDate;

          if (
            typeof data.dealExpiration.toDate ===
            'function'
          ) {
            expirationDate =
              data.dealExpiration.toDate();
          } else {
            expirationDate =
              new Date(data.dealExpiration);
          }

          if (
            Number.isNaN(
              expirationDate.getTime()
            ) ||
            expirationDate <= now
          ) {
            isValidDeal = false;
          }
        }

        if (isValidDeal) {
          products.push({
            id: productDoc.id,
            ...data
          });
        }
      }
    );

    console.log(
      `Loaded ${products.length} deal products`
    );

    return products;
  } catch (error) {
    console.error(
      'Error loading deal products:',
      error
    );

    return [];
  }
}

/* ================================
   PRODUCT BADGES
   ================================ */

function renderProductBadge(product) {
  if (product.featured) {
    return `
      <span class="product-badge">
        Featured
      </span>
    `;
  }

  if (product.trending) {
    return `
      <span class="product-badge trending">
        Trending
      </span>
    `;
  }

  if (product.bestseller) {
    return `
      <span class="product-badge bestseller">
        Bestseller
      </span>
    `;
  }

  if (product.newArrival) {
    return `
      <span class="product-badge new">
        New
      </span>
    `;
  }

  return '';
}

/* ================================
   PRODUCT STAR RATING
   ================================ */

function renderStars(rating) {
  const safeRating = clamp(
    toNumber(rating),
    0,
    5
  );

  const fullStars =
    Math.floor(safeRating);

  const hasHalfStar =
    safeRating - fullStars >= 0.5;

  const emptyStars =
    5 -
    fullStars -
    (hasHalfStar ? 1 : 0);

  let html = '';

  for (
    let index = 0;
    index < fullStars;
    index++
  ) {
    html += `
      <svg
        class="rating-star filled"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    `;
  }

  if (hasHalfStar) {
    html += `
      <svg
        class="rating-star half"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    `;
  }

  for (
    let index = 0;
    index < emptyStars;
    index++
  ) {
    html += `
      <svg
        class="rating-star empty"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    `;
  }

  return html;
}

/* ================================
   PRODUCT CARD RENDERING
   ================================ */

export function renderProductCard(
  product,
  currency = null
) {
  const selectedCurrency =
    currency ||
    getCurrentCurrency();

  const basePrice = Math.max(
    0,
    toNumber(
      product.basePrice ??
      product.price ??
      0
    )
  );

  const originalPrice = Math.max(
    0,
    toNumber(
      product.originalPrice ??
      basePrice
    )
  );

  const discount = clamp(
    toNumber(product.discount),
    0,
    100
  );

  const currentPriceConverted =
    convertCurrency(
      basePrice,
      selectedCurrency
    );

  const originalPriceConverted =
    convertCurrency(
      originalPrice,
      selectedCurrency
    );

  const formattedCurrentPrice =
    formatPrice(
      currentPriceConverted,
      selectedCurrency
    );

  const formattedOriginalPrice =
    formatPrice(
      originalPriceConverted,
      selectedCurrency
    );

  const showOriginalPrice =
    discount > 0 &&
    originalPrice > basePrice;

  const imageUrl =
    getProductImage(product);

  const safeImageUrl =
    escapeHtml(imageUrl);

  const rating = clamp(
    toNumber(product.rating),
    0,
    5
  );

  const reviewCount = Math.max(
    0,
    toNumber(product.reviewCount)
  );

  const productId =
    escapeHtml(
      safeText(product.id)
    );

  const title =
    escapeHtml(
      safeText(
        product.title,
        DEFAULT_PRODUCT_TITLE
      )
    );

  const category =
    escapeHtml(
      safeText(
        product.category,
        DEFAULT_PRODUCT_CATEGORY
      )
    );

  const safeCurrency =
    escapeHtml(selectedCurrency);

  const safeDiscount =
    Math.round(discount);

  const badge =
    renderProductBadge(product);

  const stars =
    renderStars(rating);

  const affiliateUrl =
    getSafeExternalUrl(
      product.affiliateUrl
    );

  return `
    <article
      class="product-card"
      data-product-id="${productId}"
    >
      <div class="product-image-container">

        <img
          src="${safeImageUrl}"
          alt="${title}"
          class="product-image"
          loading="lazy"
          decoding="async"
        >

        ${badge}

        ${
          showOriginalPrice
            ? `
              <span class="product-sale-badge">
                -${safeDiscount}%
              </span>
            `
            : ''
        }

        <button
          class="product-favorite"
          data-product-id="${productId}"
          type="button"
          aria-label="Add to favorites"
          aria-pressed="false"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>

      <div class="product-content">

        <p class="product-category">
          ${category}
        </p>

        <h3 class="product-title">
          ${title}
        </h3>

        <div
          class="product-rating"
          aria-label="Rating ${rating} out of 5"
        >
          <span class="product-stars">
            ${stars}
          </span>

          <span class="product-rating-value">
            ${rating.toFixed(1)}
          </span>

          <span class="product-review-count">
            (${reviewCount})
          </span>
        </div>

        <div class="product-price">

          <span
            class="product-price-current"
            data-base-price="${basePrice}"
            data-currency="${safeCurrency}"
          >
            ${formattedCurrentPrice}
          </span>

          ${
            showOriginalPrice
              ? `
                <span
                  class="product-price-original"
                  data-base-price="${originalPrice}"
                  data-currency="${safeCurrency}"
                >
                  ${formattedOriginalPrice}
                </span>

                <span class="product-discount">
                  -${safeDiscount}%
                </span>
              `
              : ''
          }

        </div>

        <div class="product-actions">

          ${
            affiliateUrl
              ? `
                <a
                  href="${affiliateUrl}"
                  class="btn btn-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Shop ${title} on AliExpress"
                >
                  Shop on AliExpress
                </a>
              `
              : `
                <button
                  class="btn btn-outline"
                  type="button"
                  disabled
                >
                  Unavailable
                </button>
              `
          }

        </div>

      </div>
    </article>
  `;
}

/* ================================
   PRODUCT GRID RENDERING
   ================================ */

export function renderProductsGrid(
  products,
  containerId,
  currency = null
) {
  const container =
    document.getElementById(containerId);

  if (!container) {
    console.warn(
      `Product container "${containerId}" not found`
    );

    return;
  }

  if (
    !Array.isArray(products) ||
    products.length === 0
  ) {
    finishGridLoading(container);

    showEmptyState(
      container,
      'No products found'
    );

    return;
  }

  container.innerHTML =
    products
      .map((product) =>
        renderProductCard(
          product,
          currency
        )
      )
      .join('');

  finishGridLoading(container);

  setupFavoriteButtons(container);

  updateFavoriteButtonStates(container);

  console.log(
    `Rendered ${products.length} products in ${containerId}`
  );
}

/* ================================
   FAVORITE BUTTONS
   ================================ */

function setupFavoriteButtons(container) {
  const favoriteButtons =
    container.querySelectorAll(
      '.product-favorite'
    );

  favoriteButtons.forEach((button) => {
    button.addEventListener(
      'click',
      async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const productId =
          button.dataset.productId;

        if (!productId) {
          return;
        }

        await toggleFavorite(
          productId,
          button
        );
      }
    );
  });
}

async function updateFavoriteButtonStates(
  container
) {
  if (!isAuthenticated()) {
    return;
  }

  try {
    const favorites =
      await loadUserFavorites();

    const favoriteSet =
      new Set(favorites);

    const buttons =
      container.querySelectorAll(
        '.product-favorite'
      );

    buttons.forEach((button) => {
      const productId =
        button.dataset.productId;

      const isFavorite =
        favoriteSet.has(productId);

      button.classList.toggle(
        'active',
        isFavorite
      );

      button.setAttribute(
        'aria-pressed',
        String(isFavorite)
      );

      button.setAttribute(
        'aria-label',
        isFavorite
          ? 'Remove from favorites'
          : 'Add to favorites'
      );
    });
  } catch (error) {
    console.error(
      'Error updating favorite button states:',
      error
    );
  }
}

async function toggleFavorite(
  productId,
  button
) {
  if (!isAuthenticated()) {
    showToast(
      'Please sign in to add favorites',
      'warning'
    );

    return;
  }

  if (!isFirebaseInitialized()) {
    showToast(
      'Service unavailable',
      'error'
    );

    return;
  }

  const userId = getUserId();

  if (!userId) {
    showToast(
      'Unable to identify your account',
      'error'
    );

    return;
  }

  const wasActive =
    button.classList.contains('active');

  button.disabled = true;

  try {
    const favoriteRef =
      doc(
        db,
        'users',
        userId,
        'favorites',
        productId
      );

    if (wasActive) {
      await deleteDoc(favoriteRef);

      button.classList.remove('active');

      button.setAttribute(
        'aria-pressed',
        'false'
      );

      button.setAttribute(
        'aria-label',
        'Add to favorites'
      );

      showToast(
        'Removed from favorites',
        'success'
      );
    } else {
      await setDoc(
        favoriteRef,
        {
          productId,
          addedAt: Timestamp.now()
        }
      );

      button.classList.add('active');

      button.setAttribute(
        'aria-pressed',
        'true'
      );

      button.setAttribute(
        'aria-label',
        'Remove from favorites'
      );

      showToast(
        'Added to favorites',
        'success'
      );
    }

    await updateFavoritesBadge();
  } catch (error) {
    console.error(
      'Error toggling favorite:',
      error
    );

    showToast(
      'Failed to update favorites',
      'error'
    );
  } finally {
    button.disabled = false;
  }
}

export async function loadUserFavorites() {
  if (
    !isAuthenticated() ||
    !isFirebaseInitialized()
  ) {
    return [];
  }

  const userId = getUserId();

  if (!userId) {
    return [];
  }

  try {
    const favoritesCollection =
      collection(
        db,
        'users',
        userId,
        'favorites'
      );

    const querySnapshot =
      await getDocs(favoritesCollection);

    const favorites = [];

    querySnapshot.forEach((favoriteDoc) => {
      favorites.push(favoriteDoc.id);
    });

    console.log(
      `Loaded ${favorites.length} favorites`
    );

    return favorites;
  } catch (error) {
    console.error(
      'Error loading favorites:',
      error
    );

    return [];
  }
}

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

  try {
    const favorites =
      await loadUserFavorites();

    badge.textContent =
      String(favorites.length);
  } catch (error) {
    console.error(
      'Error updating favorites badge:',
      error
    );

    badge.textContent = '0';
  }
}

/* ================================
   HOMEPAGE PRODUCT STATE
   ================================ */

let homepageTrendingProducts = [];
let homepageFeaturedProducts = [];
let homepageDealProduct = null;

/* ================================
   HOMEPAGE INITIALIZATION
   ================================ */

export async function initializeHomepageProducts() {
  console.log(
    'Initializing homepage products...'
  );

  const trendingContainer =
    document.getElementById(
      'trendingProductsGrid'
    );

  const collectionContainer =
    document.getElementById(
      'trendingCollectionGrid'
    );

  /*
   * Display skeleton cards immediately before
   * starting the Firestore requests.
   */
  if (trendingContainer) {
    renderSkeletonGrid(trendingContainer);
  }

  if (collectionContainer) {
    renderSkeletonGrid(collectionContainer);
  }

  const trendingTask = (async () => {
    if (!trendingContainer) {
      return;
    }

    try {
      homepageTrendingProducts =
        await loadTrendingProducts(8);

      renderProductsGrid(
        homepageTrendingProducts,
        'trendingProductsGrid'
      );
    } catch (error) {
      console.error(
        'Error loading trending products:',
        error
      );

      homepageTrendingProducts = [];

      finishGridLoading(trendingContainer);

      showError(
        trendingContainer,
        'Failed to load trending products'
      );
    }
  })();

  const collectionTask = (async () => {
    if (!collectionContainer) {
      return;
    }

    try {
      homepageFeaturedProducts =
        await loadFeaturedProducts(8);

      renderProductsGrid(
        homepageFeaturedProducts,
        'trendingCollectionGrid'
      );
    } catch (error) {
      console.error(
        'Error loading featured collection:',
        error
      );

      homepageFeaturedProducts = [];

      finishGridLoading(collectionContainer);

      showError(
        collectionContainer,
        'Failed to load collection'
      );
    }
  })();

  await Promise.all([
    trendingTask,
    collectionTask,
    initializeFeaturedDeal()
  ]);

  console.log(
    'Homepage products initialized'
  );
}

/* ================================
   FEATURED DEAL
   ================================ */

async function initializeFeaturedDeal() {
  const dealContainer =
    document.getElementById('dealCard');

  if (!dealContainer) {
    return;
  }

  showLoading(
    dealContainer,
    'Loading featured deal...'
  );

  try {
    const dealProducts =
      await loadDealProducts(1);

    if (dealProducts.length === 0) {
      homepageDealProduct = null;

      showEmptyState(
        dealContainer,
        'No active deals at the moment'
      );

      return;
    }

    homepageDealProduct =
      dealProducts[0];

    renderFeaturedDeal(
      homepageDealProduct,
      dealContainer
    );
  } catch (error) {
    console.error(
      'Error loading featured deal:',
      error
    );

    homepageDealProduct = null;

    showError(
      dealContainer,
      'Failed to load deal'
    );
  }
}

function renderFeaturedDeal(
  product,
  container
) {
  const currency =
    getCurrentCurrency();

  const basePrice = Math.max(
    0,
    toNumber(
      product.basePrice ??
      product.price ??
      0
    )
  );

  const originalPrice = Math.max(
    0,
    toNumber(
      product.originalPrice ??
      basePrice
    )
  );

  const currentPriceConverted =
    convertCurrency(basePrice, currency);

  const originalPriceConverted =
    convertCurrency(originalPrice, currency);

  const formattedCurrentPrice =
    formatPrice(
      currentPriceConverted,
      currency
    );

  const formattedOriginalPrice =
    formatPrice(
      originalPriceConverted,
      currency
    );

  const imageUrl =
    getProductImage(product);

  const safeImageUrl =
    escapeHtml(imageUrl);

  const title =
    escapeHtml(
      safeText(
        product.title,
        'Featured Deal'
      )
    );

  const affiliateUrl =
    getSafeExternalUrl(
      product.affiliateUrl
    );

  const discount = clamp(
    toNumber(product.discount),
    0,
    100
  );

  let expirationDate = null;

  if (product.dealExpiration) {
    try {
      expirationDate =
        typeof product.dealExpiration.toDate ===
        'function'
          ? product.dealExpiration.toDate()
          : new Date(product.dealExpiration);

      if (
        Number.isNaN(
          expirationDate.getTime()
        )
      ) {
        expirationDate = null;
      }
    } catch (error) {
      expirationDate = null;
    }
  }

  const countdownHtml =
    expirationDate
      ? renderCountdown()
      : '';

  container.innerHTML = `
    <div class="deal-content">

      <h3>Limited Time Deal!</h3>

      <p class="deal-title">
        ${title}
      </p>

      ${countdownHtml}

      <div class="deal-price">

        <span
          class="deal-price-current"
          data-base-price="${basePrice}"
          data-currency="${escapeHtml(currency)}"
        >
          ${formattedCurrentPrice}
        </span>

        ${
          originalPrice > basePrice
            ? `
              <span
                class="deal-price-original"
                data-base-price="${originalPrice}"
                data-currency="${escapeHtml(currency)}"
              >
                ${formattedOriginalPrice}
              </span>
            `
            : ''
        }

        ${
          discount > 0
            ? `
              <span class="deal-discount">
                Save ${Math.round(discount)}%
              </span>
            `
            : ''
        }

      </div>

      ${
        affiliateUrl
          ? `
            <a
              href="${affiliateUrl}"
              class="btn btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get This Deal
            </a>
          `
          : ''
      }

    </div>

    <div class="deal-image">
      <img
        src="${safeImageUrl}"
        alt="${title}"
        loading="lazy"
        decoding="async"
      >
    </div>
  `;

  if (expirationDate) {
    startCountdown(
      expirationDate,
      container
    );
  }
}

/* ================================
   DEAL COUNTDOWN
   ================================ */

function renderCountdown() {
  return `
    <div
      class="deal-timer"
      id="dealTimer"
      aria-label="Time remaining for this deal"
    >
      <div class="timer-unit">
        <span
          class="timer-value"
          data-unit="days"
        >00</span>
        <span class="timer-label">Days</span>
      </div>

      <div class="timer-unit">
        <span
          class="timer-value"
          data-unit="hours"
        >00</span>
        <span class="timer-label">Hours</span>
      </div>

      <div class="timer-unit">
        <span
          class="timer-value"
          data-unit="minutes"
        >00</span>
        <span class="timer-label">Minutes</span>
      </div>

      <div class="timer-unit">
        <span
          class="timer-value"
          data-unit="seconds"
        >00</span>
        <span class="timer-label">Seconds</span>
      </div>
    </div>
  `;
}

function startCountdown(
  expirationDate,
  container
) {
  let timerId = null;

  function updateCountdown() {
    const difference =
      expirationDate.getTime() -
      Date.now();

    if (difference <= 0) {
      const timer =
        container.querySelector('#dealTimer');

      if (timer) {
        timer.textContent = 'Deal expired';
      }

      if (timerId !== null) {
        clearTimeout(timerId);
      }

      return;
    }

    const days =
      Math.floor(
        difference / (1000 * 60 * 60 * 24)
      );

    const hours =
      Math.floor(
        (
          difference % (1000 * 60 * 60 * 24)
        ) / (1000 * 60 * 60)
      );

    const minutes =
      Math.floor(
        (
          difference % (1000 * 60 * 60)
        ) / (1000 * 60)
      );

    const seconds =
      Math.floor(
        (difference % (1000 * 60)) / 1000
      );

    const values = {
      days,
      hours,
      minutes,
      seconds
    };

    Object.entries(values).forEach(
      ([unit, value]) => {
        const element =
          container.querySelector(
            `[data-unit="${unit}"]`
          );

        if (element) {
          element.textContent =
            String(value).padStart(2, '0');
        }
      }
    );

    timerId = setTimeout(
      updateCountdown,
      1000
    );
  }

  updateCountdown();
}

/* ================================
   CURRENCY CHANGE HANDLING
   ================================ */

function updateRenderedProductPrices() {
  const currency =
    getCurrentCurrency();

  const priceElements =
    document.querySelectorAll(
      '[data-base-price]'
    );

  priceElements.forEach((priceElement) => {
    const basePrice =
      Number(priceElement.dataset.basePrice);

    if (!Number.isFinite(basePrice)) {
      return;
    }

    const convertedPrice =
      convertCurrency(
        basePrice,
        currency
      );

    priceElement.textContent =
      formatPrice(
        convertedPrice,
        currency
      );

    priceElement.dataset.currency =
      currency;
  });
}

document.addEventListener(
  'currencyChanged',
  () => {
    console.log(
      'Currency changed; updating product prices...'
    );

    updateRenderedProductPrices();
  }
);

/* ================================
   AUTO-INITIALIZATION
   ================================ */

/*
 * app.js controls homepage initialization.
 * Do not auto-initialize from this module.
 */

console.log(
  'Products module loaded'
);
