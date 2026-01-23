# Pressure Test Scenarios: Architectural Layering

These scenarios test whether the pr-review skill catches "fat route" anti-patterns where API routes contain business logic that should be extracted to application/service layers.

## Scenario 5: Fat API Route with Business Logic (from PR #332)

**Code Under Review:**
```typescript
// File: src/app/api/brand/surveys/[id]/result/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSurveyService } from '@/backend/modules/survey';
import { getBrandService } from '@/backend/modules/brand';
import { getResultPageConfig } from '@/backend/modules/survey/config-adapters';
import { handleValidationError } from '@backend/lib/validation/error-handler';
import { logger } from '@backend/lib/logging';
import beamsBrands from '@/frontend/components/admin/customer-portal/beams-brands.json';

interface BeamsBrandResult {
  value: string;
  title: string;
  description: string;
  imageUrl: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params;
    const body = await request.json();
    const { responseData, brandId: requestBrandId } = body;

    // Brand resolution logic
    const brandFromHeaders = getApiRouteBrand(request);
    const brandId = brandFromHeaders?.id || requestBrandId;

    if (!brandId) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const brandService = await getBrandService();
    const brand = await brandService.getBrandById(brandId);

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    // Get survey
    const surveyService = await getSurveyService();
    const survey = await surveyService.getSurveyWithPublishStatus(surveyId);

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Verify survey belongs to this brand
    if (survey.brand_id !== brand.id) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Get result page config
    const config = getResultPageConfig(survey);

    // If static mode, return config directly
    if (config.mode !== 'dynamic') {
      return NextResponse.json({
        mode: 'static',
        source: 'config',
        title: config.title,
        description: config.description,
        imageUrl: config.imageUrl,
        imageSettings: config.imageSettings,
        customizations: config.customizations,
      });
    }

    // DYNAMIC MODE: Complex business logic
    try {
      const categoryAnswer = extractCategoryFromResponse(responseData);
      const brandResult =
        (beamsBrands as BeamsBrandResult[]).find(
          (b) => b.value === categoryAnswer
        ) || (beamsBrands as BeamsBrandResult[])[0];

      return NextResponse.json({
        mode: 'dynamic',
        source: 'webhook',
        title: brandResult.title,
        description: brandResult.description,
        imageUrl: brandResult.imageUrl,
        imageSettings: config.imageSettings,
        customizations: config.customizations,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch dynamic result content');

      // Fallback logic
      return NextResponse.json({
        mode: 'dynamic',
        source: 'fallback',
        fallbackReason: 'error',
        title: config.title,
        description: config.description,
        imageUrl: config.imageUrl,
        imageSettings: config.imageSettings,
        customizations: config.customizations,
      });
    }
  } catch (error) {
    return handleValidationError(error);
  }
}

// Helper function defined in route file (code smell)
function extractCategoryFromResponse(
  responseData: Record<string, unknown>
): string {
  if (!responseData || typeof responseData !== 'object') {
    return 'A';
  }

  const possibleKeys = [
    'category', 'style', 'preference', 'type', 'result',
    'q1', 'question1', 'beams_category', 'beams_result',
  ];

  for (const key of possibleKeys) {
    const value = responseData[key];
    if (typeof value === 'string' && ['A', 'B', 'C', 'D'].includes(value)) {
      return value;
    }
  }

  for (const value of Object.values(responseData)) {
    if (typeof value === 'string' && ['A', 'B', 'C', 'D'].includes(value)) {
      return value;
    }
  }

  return 'A';
}
```

**Expected Issues to Catch:**

1. **Fat Route Pattern** - Route file contains 100+ lines of business logic
2. **Multiple Service Orchestration** - Route coordinates brandService + surveyService + config logic
3. **Helper Functions in Route** - `extractCategoryFromResponse` should not live in route file
4. **Complex Branching** - Static vs dynamic mode logic with fallback handling
5. **Import from Frontend** - Route imports from frontend (beams-brands.json)

**Expected Structural Recommendation:**

```typescript
// AFTER: Thin route delegating to application layer
import { NextRequest, NextResponse } from 'next/server';
import { getApiRouteBrand } from '@backend/lib/auth/require-auth';
import { handleValidationError } from '@backend/lib/validation/error-handler';
import { getSurveyResultContent } from '@/backend/applications/survey-result';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params;
    const body = await request.json();
    const { responseData, brandId: requestBrandId } = body;

    const brandFromHeaders = getApiRouteBrand(request);
    const brandId = brandFromHeaders?.id || requestBrandId;

    if (!brandId) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    // Delegate to application layer
    const result = await getSurveyResultContent({
      surveyId,
      brandId,
      responseData: responseData || {},
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode }
      );
    }

    const { success, ...response } = result;
    return NextResponse.json(response);
  } catch (error) {
    return handleValidationError(error);
  }
}
```

---

## Scenario 6: Route with Inline Validation + Transformation Logic

**Code Under Review:**
```typescript
// File: src/app/api/brand/products/import/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getProductService } from '@/backend/modules/product';
import { getBrandService } from '@/backend/modules/brand';
import { parseCSV } from '@/backend/shared/csv';
import { logger } from '@backend/lib/logging';

interface ProductRow {
  sku: string;
  name: string;
  price: string;
  category: string;
  description?: string;
  imageUrl?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const brandId = formData.get('brandId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Parse CSV
    const content = await file.text();
    const rows = parseCSV<ProductRow>(content);

    // Validate all rows
    const errors: ValidationError[] = [];
    const validProducts: ProductRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 for header row and 0-indexing

      // SKU validation
      if (!row.sku || row.sku.trim() === '') {
        errors.push({ row: rowNumber, field: 'sku', message: 'SKU is required' });
        continue;
      }

      if (!/^[A-Z0-9-]+$/i.test(row.sku)) {
        errors.push({ row: rowNumber, field: 'sku', message: 'SKU must be alphanumeric with hyphens' });
        continue;
      }

      // Name validation
      if (!row.name || row.name.trim() === '') {
        errors.push({ row: rowNumber, field: 'name', message: 'Name is required' });
        continue;
      }

      if (row.name.length > 200) {
        errors.push({ row: rowNumber, field: 'name', message: 'Name must be under 200 characters' });
        continue;
      }

      // Price validation
      const price = parseFloat(row.price);
      if (isNaN(price) || price < 0) {
        errors.push({ row: rowNumber, field: 'price', message: 'Price must be a positive number' });
        continue;
      }

      // Category validation
      const validCategories = ['electronics', 'clothing', 'food', 'other'];
      if (!validCategories.includes(row.category.toLowerCase())) {
        errors.push({ row: rowNumber, field: 'category', message: `Category must be one of: ${validCategories.join(', ')}` });
        continue;
      }

      // Transform to product entity
      validProducts.push({
        ...row,
        sku: row.sku.toUpperCase(),
        name: row.name.trim(),
        price: price.toFixed(2),
        category: row.category.toLowerCase(),
      });
    }

    // If too many errors, abort
    if (errors.length > 10) {
      return NextResponse.json({
        success: false,
        error: 'Too many validation errors',
        errors: errors.slice(0, 10),
        totalErrors: errors.length,
      }, { status: 400 });
    }

    // Import valid products
    const productService = await getProductService();
    const results = await productService.bulkCreate(brandId, validProducts);

    return NextResponse.json({
      success: true,
      imported: results.created,
      updated: results.updated,
      errors: errors,
    });
  } catch (error) {
    logger.error({ error }, 'Product import failed');
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
```

**Expected Issues to Catch:**

1. **Validation Logic in Route** - 60+ lines of validation should be in validator/DTO
2. **Transformation Logic** - Data normalization should be in service/application
3. **Business Rules** - Category list, error thresholds embedded in route
4. **No Separation of Concerns** - Parse, validate, transform, persist all in one function

**Expected Structural Recommendation:**
- Extract to `src/backend/applications/brand-product/import.application.ts`
- Or create `src/backend/modules/product/validators/product-import.validator.ts`
- Business rules (valid categories, error threshold) should be configurable

---

## Detection Criteria (Hybrid Approach)

### General Principles (Always Apply)

| Symptom | Indicates |
|---------|-----------|
| Route file > 80 lines | Likely contains extractable logic |
| Multiple service calls in single route | Orchestration logic should be in application layer |
| Helper functions defined in route file | Logic belongs in module/utility |
| Complex branching (3+ code paths) | Business logic should be extracted |
| Inline validation > 20 lines | Should use DTO/validator pattern |
| Data transformation in route | Should be in service/mapper |
| Imports from unrelated modules (e.g., frontend) | Architectural boundary violation |

### Project-Aware Recommendations

When suggesting WHERE to extract:

1. **Check for existing patterns:**
   - `src/backend/applications/` → suggest application layer
   - `src/backend/services/` → suggest service layer
   - `src/backend/modules/*/` → suggest module service

2. **Match existing naming conventions:**
   - `*.application.ts` pattern
   - `*.service.ts` pattern
   - `index.ts` barrel exports

3. **If no pattern exists:**
   - Recommend general extraction
   - Suggest creating `applications/` or `services/` directory

---

## Success Criteria

The improved pr-review skill should:

1. **Detect fat routes** using line count + complexity heuristics
2. **Identify specific code smells** (helper functions, inline validation, etc.)
3. **Check project structure** to give specific extraction recommendations
4. **Explain the layering principle** - routes should be thin controllers
5. **Provide concrete refactoring path** based on existing project conventions
