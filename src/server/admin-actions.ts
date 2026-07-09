'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createProduct,
  updateProduct,
  setProductStatus,
} from '@/lib/catalog-service';
import {
  saveBrand,
  saveCategory,
  saveTag,
  saveAttribute,
  addAttributeValue,
  updateAttributeValueSlug,
  moveAttributeValue,
  deleteAttributeValue,
} from '@/lib/taxonomy-service';
import { savePage, savePost, saveCollection } from '@/lib/content-service';
import {
  InUseError,
  archiveBrand, deleteBrand,
  archiveCategory, deleteCategory,
  archiveTag, deleteTag,
  archiveAttribute, deleteAttribute,
  archiveCoupon, deleteCoupon,
  archiveGift, deleteGift,
  archiveCollection, deleteCollection,
  archivePage, deletePage,
  archivePost, deletePost,
  deleteProduct,
} from '@/lib/soft-delete-service';

export type AdminFormState = { error?: string };

// ---- Soft-delete dispatch (archive/restore + guarded hard-delete) ----------
type ArchiveFn = (id: string, archived: boolean) => Promise<unknown>;
type DeleteFn = (id: string) => Promise<unknown>;

const ARCHIVERS: Record<string, ArchiveFn> = {
  brand: archiveBrand, category: archiveCategory, tag: archiveTag, attribute: archiveAttribute,
  coupon: archiveCoupon, gift: archiveGift, collection: archiveCollection, page: archivePage, post: archivePost,
};
const DELETERS: Record<string, DeleteFn> = {
  brand: deleteBrand, category: deleteCategory, tag: deleteTag, attribute: deleteAttribute,
  coupon: deleteCoupon, gift: deleteGift, collection: deleteCollection, page: deletePage, post: deletePost,
  product: deleteProduct,
};

// ---- FormData helpers ------------------------------------------------------
const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string): string | undefined => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const bool = (fd: FormData, k: string): boolean => fd.get(k) != null;
const arr = (fd: FormData, k: string): string[] =>
  fd.getAll(k).filter((v): v is string => typeof v === 'string' && v !== '');

function fail(e: unknown): AdminFormState {
  if (e instanceof Error && e.message === 'FORBIDDEN') return { error: 'forbidden' };
  console.error('admin action failed', e);
  return { error: 'invalid' };
}

function done(locale: string, path: string): never {
  revalidatePath(`/${locale}/admin/${path}`);
  redirect(`/${locale}/admin/${path}`);
}

// ---- Products --------------------------------------------------------------
export async function saveProductAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  const id = str(fd, 'id') ?? null;
  const input = {
    sku: str(fd, 'sku'),
    nameEn: str(fd, 'nameEn') ?? '',
    nameAr: str(fd, 'nameAr'),
    slugEn: str(fd, 'slugEn'),
    slugAr: str(fd, 'slugAr'),
    kind: (str(fd, 'kind') ?? 'SUPPLEMENT') as 'SUPPLEMENT' | 'DEVICE' | 'INJECTION',
    status: (str(fd, 'status') ?? 'PUBLISHED') as 'DRAFT' | 'PUBLISHED' | 'PRIVATE' | 'ARCHIVED',
    preorderEnabled: bool(fd, 'preorderEnabled'),
    brandId: str(fd, 'brandId') ?? null,
    basePriceEgp: str(fd, 'basePriceEgp') ?? '0',
    shortDescEn: str(fd, 'shortDescEn'),
    shortDescAr: str(fd, 'shortDescAr'),
    longDescEn: str(fd, 'longDescEn'),
    longDescAr: str(fd, 'longDescAr'),
    weightG: str(fd, 'weightG'),
    servingsPerUnit: str(fd, 'servingsPerUnit'),
    dailyDosage: str(fd, 'dailyDosage'),
    dailyDosageMax: str(fd, 'dailyDosageMax'),
    productType: (str(fd, 'productType') ?? null) as
      | 'MISCELLANEOUS' | 'MALE_SUPPORT' | 'PREMIUM' | 'NEW' | 'TREND' | null,
    maleSupport: bool(fd, 'maleSupport'),
    purchaseUrl: str(fd, 'purchaseUrl'),
    originCountry: (str(fd, 'originCountry') ?? null) as 'USA' | 'UK' | 'EU' | null,
    purchaseCost: str(fd, 'purchaseCost'),
    categoryIds: arr(fd, 'categoryIds'),
    tagIds: arr(fd, 'tagIds'),
    attributeValueIds: arr(fd, 'attributeValueIds'),
    imageUrls: arr(fd, 'imageUrls'),
    restricted: bool(fd, 'restricted'),
    restrictHideCatalog: bool(fd, 'restrictHideCatalog'),
    restrictHideFeeds: bool(fd, 'restrictHideFeeds'),
    restrictDisableCards: bool(fd, 'restrictDisableCards'),
    restrictRequireLogin: bool(fd, 'restrictRequireLogin'),
    restrictAgeConsent: bool(fd, 'restrictAgeConsent'),
    metaTitleEn: str(fd, 'metaTitleEn'),
    metaTitleAr: str(fd, 'metaTitleAr'),
    metaDescEn: str(fd, 'metaDescEn'),
    metaDescAr: str(fd, 'metaDescAr'),
    aiSummaryEn: str(fd, 'aiSummaryEn'),
    aiSummaryAr: str(fd, 'aiSummaryAr'),
    focusKeywordEn: str(fd, 'focusKeywordEn'),
    focusKeywordAr: str(fd, 'focusKeywordAr'),
    secondaryKeywordsEn: str(fd, 'secondaryKeywordsEn'),
    secondaryKeywordsAr: str(fd, 'secondaryKeywordsAr'),
    ogTitleEn: str(fd, 'ogTitleEn'),
    ogTitleAr: str(fd, 'ogTitleAr'),
    ogDescEn: str(fd, 'ogDescEn'),
    ogDescAr: str(fd, 'ogDescAr'),
    ogImage: str(fd, 'ogImage'),
    canonicalUrl: str(fd, 'canonicalUrl'),
    robotsIndex: bool(fd, 'robotsIndex'),
    robotsFollow: bool(fd, 'robotsFollow'),
    schemaOverrides: str(fd, 'schemaOverrides'),
  };
  try {
    if (id) await updateProduct(id, input);
    else await createProduct(input);
  } catch (e) {
    return fail(e);
  }
  done(locale, 'products');
}

export async function setProductStatusAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const status = str(fd, 'status') as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | undefined;
  if (id && status) {
    try {
      await setProductStatus(id, status);
    } catch (e) {
      fail(e);
    }
  }
  done(locale, 'products');
}

// ---- Taxonomy --------------------------------------------------------------
export async function saveBrandAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveBrand(str(fd, 'id') ?? null, {
      nameEn: str(fd, 'nameEn') ?? '', nameAr: str(fd, 'nameAr'), slug: str(fd, 'slug'),
      descriptionEn: str(fd, 'descriptionEn'), descriptionAr: str(fd, 'descriptionAr'),
      logoUrl: str(fd, 'logoUrl'), bannerUrl: str(fd, 'bannerUrl'),
      ...seoFieldsOf(fd),
    });
  } catch (e) { return fail(e); }
  done(locale, 'brands');
}

/** Full-SEO-module fields shared by the brand/category save actions. */
function seoFieldsOf(fd: FormData) {
  return {
    slugAr: str(fd, 'slugAr'),
    metaTitleEn: str(fd, 'metaTitleEn'), metaTitleAr: str(fd, 'metaTitleAr'),
    metaDescEn: str(fd, 'metaDescEn'), metaDescAr: str(fd, 'metaDescAr'),
    focusKeywordEn: str(fd, 'focusKeywordEn'), focusKeywordAr: str(fd, 'focusKeywordAr'),
    secondaryKeywordsEn: str(fd, 'secondaryKeywordsEn'), secondaryKeywordsAr: str(fd, 'secondaryKeywordsAr'),
    ogTitleEn: str(fd, 'ogTitleEn'), ogTitleAr: str(fd, 'ogTitleAr'),
    ogDescEn: str(fd, 'ogDescEn'), ogDescAr: str(fd, 'ogDescAr'),
    ogImage: str(fd, 'ogImage'), canonicalUrl: str(fd, 'canonicalUrl'),
    robotsIndex: bool(fd, 'robotsIndex'), robotsFollow: bool(fd, 'robotsFollow'),
    schemaOverrides: str(fd, 'schemaOverrides'),
  };
}

export async function saveCategoryAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveCategory(str(fd, 'id') ?? null, {
      nameEn: str(fd, 'nameEn') ?? '', nameAr: str(fd, 'nameAr'), slug: str(fd, 'slug'),
      parentId: str(fd, 'parentId') ?? null,
      descriptionEn: str(fd, 'descriptionEn'), descriptionAr: str(fd, 'descriptionAr'),
      imageUrl: str(fd, 'imageUrl'),
      ...seoFieldsOf(fd),
    });
  } catch (e) { return fail(e); }
  done(locale, 'categories');
}

export async function saveTagAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveTag(str(fd, 'id') ?? null, { nameEn: str(fd, 'nameEn') ?? '', nameAr: str(fd, 'nameAr'), slug: str(fd, 'slug') });
  } catch (e) { return fail(e); }
  done(locale, 'tags');
}

export async function saveAttributeAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  const kinds = arr(fd, 'kinds').filter((k): k is 'SUPPLEMENT' | 'DEVICE' | 'INJECTION' => k === 'SUPPLEMENT' || k === 'DEVICE' || k === 'INJECTION');
  try {
    await saveAttribute(str(fd, 'id') ?? null, {
      key: str(fd, 'key') ?? '', nameEn: str(fd, 'nameEn') ?? '', nameAr: str(fd, 'nameAr'),
      kinds: kinds.length ? kinds : ['SUPPLEMENT'],
      inputType: (str(fd, 'inputType') ?? 'SINGLE_SELECT') as 'SINGLE_SELECT' | 'MULTI_SELECT',
      descriptionEn: str(fd, 'descriptionEn'), descriptionAr: str(fd, 'descriptionAr'),
      unit: str(fd, 'unit'),
      isFilterable: fd.get('isFilterable') != null,
      isRequired: fd.get('isRequired') != null,
    });
  } catch (e) { return fail(e); }
  done(locale, 'attributes');
}

export async function addAttributeValueAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const attributeId = str(fd, 'attributeId');
  const valueEn = str(fd, 'valueEn');
  if (attributeId && valueEn) {
    try { await addAttributeValue(attributeId, valueEn, str(fd, 'valueAr'), str(fd, 'slug')); } catch (e) { fail(e); }
  }
  revalidatePath(`/${locale}/admin/attributes`);
  redirect(`/${locale}/admin/attributes/${attributeId}`);
}

export async function updateAttributeValueSlugAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const attributeId = str(fd, 'attributeId');
  const valueId = str(fd, 'valueId');
  if (valueId) { try { await updateAttributeValueSlug(valueId, str(fd, 'slug') ?? ''); } catch (e) { fail(e); } }
  revalidatePath(`/${locale}/admin/attributes`);
  redirect(`/${locale}/admin/attributes/${attributeId}`);
}

export async function moveAttributeValueAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const attributeId = str(fd, 'attributeId');
  const valueId = str(fd, 'valueId');
  const dir = str(fd, 'dir') === 'up' ? 'up' : 'down';
  if (valueId) { try { await moveAttributeValue(valueId, dir); } catch (e) { fail(e); } }
  revalidatePath(`/${locale}/admin/attributes`);
  redirect(`/${locale}/admin/attributes/${attributeId}`);
}

export async function deleteAttributeValueAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'valueId');
  const attributeId = str(fd, 'attributeId');
  if (id) { try { await deleteAttributeValue(id); } catch (e) { fail(e); } }
  revalidatePath(`/${locale}/admin/attributes`);
  redirect(`/${locale}/admin/attributes/${attributeId}`);
}

// ---- Content ---------------------------------------------------------------
export async function savePageAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await savePage(str(fd, 'id') ?? null, {
      titleEn: str(fd, 'titleEn') ?? '', titleAr: str(fd, 'titleAr'), slug: str(fd, 'slug'),
      bodyEn: str(fd, 'bodyEn'), bodyAr: str(fd, 'bodyAr'),
      status: (str(fd, 'status') ?? 'DRAFT') as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
      metaTitleEn: str(fd, 'metaTitleEn'), metaDescEn: str(fd, 'metaDescEn'),
    });
  } catch (e) { return fail(e); }
  done(locale, 'content/pages');
}

export async function savePostAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await savePost(str(fd, 'id') ?? null, {
      titleEn: str(fd, 'titleEn') ?? '', titleAr: str(fd, 'titleAr'), slug: str(fd, 'slug'),
      excerptEn: str(fd, 'excerptEn'), bodyEn: str(fd, 'bodyEn'), bodyAr: str(fd, 'bodyAr'),
      coverImage: str(fd, 'coverImage'), authorName: str(fd, 'authorName'),
      status: (str(fd, 'status') ?? 'DRAFT') as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    });
  } catch (e) { return fail(e); }
  done(locale, 'content/blog');
}

export async function saveCollectionAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveCollection(str(fd, 'id') ?? null, {
      titleEn: str(fd, 'titleEn') ?? '', titleAr: str(fd, 'titleAr'), slug: str(fd, 'slug'),
      descriptionEn: str(fd, 'descriptionEn'), descriptionAr: str(fd, 'descriptionAr'),
      type: (str(fd, 'type') ?? 'MANUAL') as 'MANUAL' | 'AUTO',
      ruleCategoryId: str(fd, 'ruleCategoryId') ?? null, ruleTagSlug: str(fd, 'ruleTagSlug') ?? null,
      status: (str(fd, 'status') ?? 'DRAFT') as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
      sortOrder: Number(str(fd, 'sortOrder') || '0') || 0,
      productIds: arr(fd, 'productIds'),
      imageUrl: str(fd, 'imageUrl'), imageAltEn: str(fd, 'imageAltEn'), imageAltAr: str(fd, 'imageAltAr'),
      metaTitleEn: str(fd, 'metaTitleEn'), metaTitleAr: str(fd, 'metaTitleAr'),
      metaDescEn: str(fd, 'metaDescEn'), metaDescAr: str(fd, 'metaDescAr'),
    });
  } catch (e) { return fail(e); }
  done(locale, 'collections');
}

// ---- Archive / restore (soft-delete) ---------------------------------------
export async function archiveEntityAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const entity = str(fd, 'entity');
  const id = str(fd, 'id');
  const path = str(fd, 'path') ?? '';
  const archived = fd.get('archived') === '1';
  const fn = entity ? ARCHIVERS[entity] : undefined;
  if (fn && id) {
    try { await fn(id, archived); } catch (e) { fail(e); }
  }
  done(locale, path);
}

// ---- Guarded hard-delete (refuses when the record is in use) ----------------
export async function deleteEntityAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const entity = str(fd, 'entity');
  const id = str(fd, 'id');
  const path = str(fd, 'path') ?? '';
  const fn = entity ? DELETERS[entity] : undefined;
  if (fn && id) {
    try {
      await fn(id);
    } catch (e) {
      if (e instanceof InUseError) {
        revalidatePath(`/${locale}/admin/${path}`);
        redirect(`/${locale}/admin/${path}?error=in_use`);
      }
      fail(e);
    }
  }
  done(locale, path);
}
