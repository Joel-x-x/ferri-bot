import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { decrypt } from '../shared/utils/crypto.util';
import { envs } from '../config/envs';

export interface ErpProductPrice {
  priceType: string;   // RETAIL | WHOLESALE | PROMO | SPECIAL
  amount: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface ErpProductResult {
  id: string;
  name: string;
  sku: string | null;
  referenceCode: string | null;
  categoryName: string | null;
  brandName: string | null;
  unitOfMeasureSymbol: string | null;
  cost: number | null;
  currencyCode: string;
  availableForSale: boolean;
  prices: ErpProductPrice[];
}

export interface ErpSearchResult {
  items: ErpProductResult[];
  total: number;
}

@Injectable()
export class ErpClientService {
  private readonly logger = new Logger(ErpClientService.name);

  async searchProducts(
    erpBaseUrl: string,
    encryptedApiKey: string,
    query: string,
    page = 1,
    size = 5,
  ): Promise<ErpSearchResult> {
    const apiKey = decrypt(encryptedApiKey, envs.encryptionKey);

    try {
      const { data } = await axios.get(`${erpBaseUrl}/api/v1/products`, {
        headers: { 'X-Api-Key': apiKey },
        params: { search: query, page, size },
        timeout: 8000,
      });

      const items: ErpProductResult[] = (data?.data ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        referenceCode: p.referenceCode ?? null,
        categoryName: p.categoryName ?? null,
        brandName: p.brandName ?? null,
        unitOfMeasureSymbol: p.unitOfMeasureSymbol ?? null,
        cost: p.cost ?? null,
        currencyCode: p.currencyCode ?? 'USD',
        availableForSale: p.availableForSale ?? true,
        prices: (p.prices ?? []).map((pr: any) => ({
          priceType: pr.priceType,
          amount: pr.amount,
          isDefault: pr.isDefault,
          isActive: pr.isActive,
        })),
      }));

      return { items, total: data?.page?.totalElements ?? items.length };
    } catch (err) {
      this.logger.error(`erp.search_failed query="${query}" error=${err.message}`);
      return { items: [], total: 0 };
    }
  }

  formatForSecretary(results: ErpProductResult[]): string {
    if (!results.length) return 'No se encontraron productos en el ERP para esa búsqueda.';

    return results.map((p, i) => {
      const uom = p.unitOfMeasureSymbol ? ` / ${p.unitOfMeasureSymbol}` : '';
      const cur = p.currencyCode ?? 'USD';

      const priceLines: string[] = [];
      if (p.cost != null) {
        priceLines.push(`  • Costo: ${cur} ${p.cost.toFixed(2)}${uom}`);
      }
      const wholesale = p.prices.find(pr => pr.priceType === 'WHOLESALE' && pr.isActive);
      if (wholesale) {
        priceLines.push(`  • Mayorista: ${cur} ${Number(wholesale.amount).toFixed(2)}${uom}`);
      }
      const retail = p.prices.find(pr => pr.isDefault && pr.isActive)
                  ?? p.prices.find(pr => pr.priceType === 'RETAIL' && pr.isActive);
      if (retail) {
        priceLines.push(`  • PVP: ${cur} ${Number(retail.amount).toFixed(2)}${uom}`);
      }

      const cat = p.categoryName ? ` · ${p.categoryName}` : '';
      const brand = p.brandName ? ` · ${p.brandName}` : '';
      const stock = p.availableForSale ? 'Disponible' : 'Sin stock';

      return [
        `${i + 1}. *${p.name}*${cat}${brand} — ${stock}`,
        ...priceLines,
      ].join('\n');
    }).join('\n\n');
  }
}
