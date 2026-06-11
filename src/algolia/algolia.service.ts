import { Injectable, Logger } from '@nestjs/common';
import algoliasearch, { SearchIndex } from 'algoliasearch';
import { envs } from '../config/envs';

export interface ProductHit {
  objectID: string;
  name: string;
  minPrice?: number;
  maxPrice?: number;
  imageUrl?: string;
  categoryName?: string;
  brandName?: string;
  availableForSale: boolean;
}

@Injectable()
export class AlgoliaService {
  private readonly logger = new Logger(AlgoliaService.name);
  private readonly index: SearchIndex;

  constructor() {
    const client = algoliasearch(envs.algolia.appId, envs.algolia.searchKey);
    this.index = client.initIndex(envs.algolia.indexName);
  }

  async searchProducts(query: string, tenantId: string, hitsPerPage = 5): Promise<ProductHit[]> {
    try {
      const result = await this.index.search<ProductHit>(query, {
        filters: `tenantId:${tenantId} AND availableForSale:true`,
        hitsPerPage,
        attributesToRetrieve: ['name', 'minPrice', 'maxPrice', 'imageUrl', 'categoryName', 'brandName', 'availableForSale'],
      });
      return result.hits;
    } catch (err) {
      this.logger.error(`algolia.search_failed query="${query}" tenant=${tenantId} error=${err.message}`);
      return [];
    }
  }

  formatProductsForAi(hits: ProductHit[]): string {
    if (!hits.length) return 'No se encontraron productos para esa búsqueda.';

    return hits
      .map((h, i) => {
        const price =
          h.minPrice != null && h.maxPrice != null
            ? h.minPrice === h.maxPrice
              ? `$${h.minPrice}`
              : `$${h.minPrice} – $${h.maxPrice}`
            : 'Precio no disponible';
        const availability = h.availableForSale ? 'Disponible' : 'No disponible';
        const category = h.categoryName ? ` · ${h.categoryName}` : '';
        const brand = h.brandName ? ` · ${h.brandName}` : '';
        return `${i + 1}. ${h.name}${category}${brand} — ${price} — ${availability}`;
      })
      .join('\n');
  }
}
