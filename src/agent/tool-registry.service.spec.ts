import { ToolRegistryService } from './tool-registry.service';
import { AgentContext } from './agent.interfaces';
import { AlgoliaService } from '../algolia/algolia.service';
import { ErpClientService } from '../erp/erp-client.service';

describe('ToolRegistryService', () => {
  let service: ToolRegistryService;
  let algoliaService: jest.Mocked<AlgoliaService>;
  let erpClientService: jest.Mocked<ErpClientService>;

  beforeEach(() => {
    algoliaService = {
      searchProducts: jest.fn().mockResolvedValue([]),
      formatProductsForAi: jest.fn().mockReturnValue('No products found'),
    } as any;

    erpClientService = {
      searchProducts: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      formatForSecretary: jest.fn().mockReturnValue('No products'),
    } as any;

    service = new ToolRegistryService(algoliaService, erpClientService);
  });

  const baseContext: AgentContext = {
    tenantId: 'tenant-1',
    contactPhone: '593991234',
    salesPhone: '593995678',
    isStaff: false,
    authorities: [],
    isLinkedContact: false,
  };

  describe('resolveTools', () => {
    it('should return public tools for external agent', () => {
      const tools = service.resolveTools('EXTERNAL', baseContext);
      const names = tools.map((t) => t.name);

      expect(names).toContain('search_products');
      expect(names).toContain('send_quotation');
      expect(names).toContain('notify_advisor');
      expect(names).not.toContain('search_products_erp');
    });

    it('should exclude internal tools for external agent', () => {
      const tools = service.resolveTools('EXTERNAL', baseContext);
      const names = tools.map((t) => t.name);

      expect(names).not.toContain('search_products_erp');
    });

    it('should include ERP tool for internal agent with PRODUCT_READ', () => {
      const ctx: AgentContext = {
        ...baseContext,
        isStaff: true,
        authorities: ['PRODUCT_READ'],
      };

      const tools = service.resolveTools('INTERNAL', ctx);
      const names = tools.map((t) => t.name);

      expect(names).toContain('search_products_erp');
      expect(names).toContain('search_products');
      expect(names).toContain('send_quotation');
      expect(names).toContain('notify_advisor');
    });

    it('should exclude ERP tool for internal agent WITHOUT PRODUCT_READ', () => {
      const ctx: AgentContext = {
        ...baseContext,
        isStaff: true,
        authorities: [],
      };

      const tools = service.resolveTools('INTERNAL', ctx);
      const names = tools.map((t) => t.name);

      expect(names).not.toContain('search_products_erp');
      // Public tools still available
      expect(names).toContain('search_products');
    });

    it('should match original behavior: staff gets all 4 tools', () => {
      const ctx: AgentContext = {
        ...baseContext,
        isStaff: true,
        authorities: ['PRODUCT_READ'],
      };

      const tools = service.resolveTools('INTERNAL', ctx);
      expect(tools).toHaveLength(4);
    });

    it('should match original behavior: external gets 3 tools', () => {
      const tools = service.resolveTools('EXTERNAL', baseContext);
      expect(tools).toHaveLength(3);
    });
  });

  describe('createExecutor', () => {
    it('should execute search_products tool', async () => {
      const hits = [{ objectID: '1', name: 'Tornillo', imageUrl: 'http://img.jpg' }];
      algoliaService.searchProducts.mockResolvedValue(hits as any);
      algoliaService.formatProductsForAi.mockReturnValue('1. Tornillo');

      const executor = service.createExecutor(baseContext);
      const result = await executor.execute('search_products', { query: 'tornillo' });

      expect(result.content).toBe('1. Tornillo');
      expect(result.imageUrl).toBe('http://img.jpg');
      expect(algoliaService.searchProducts).toHaveBeenCalledWith('tornillo', 'tenant-1');
    });

    it('should execute search_products_erp tool', async () => {
      const ctx: AgentContext = {
        ...baseContext,
        erpBaseUrl: 'http://erp.test',
        erpApiKey: 'encrypted-key',
      };
      erpClientService.searchProducts.mockResolvedValue({ items: [{ name: 'Tornillo' }] as any, total: 1 });
      erpClientService.formatForSecretary.mockReturnValue('1. *Tornillo* — $2.50');

      const executor = service.createExecutor(ctx);
      const result = await executor.execute('search_products_erp', { query: 'tornillo' });

      expect(result.content).toBe('1. *Tornillo* — $2.50');
      expect(erpClientService.searchProducts).toHaveBeenCalledWith('http://erp.test', 'encrypted-key', 'tornillo');
    });

    it('should return error when ERP not configured', async () => {
      const executor = service.createExecutor(baseContext); // no erpBaseUrl
      const result = await executor.execute('search_products_erp', { query: 'tornillo' });

      expect(result.content).toContain('ERP no configurado');
    });

    it('should execute send_quotation tool', async () => {
      const executor = service.createExecutor(baseContext);
      const result = await executor.execute('send_quotation', {
        items: 'Tornillo × 100',
        total: '$25.00',
      });

      expect(result.content).toBe('Cotización enviada al asesor.');
      expect(result.vendorNotification).toEqual({
        type: 'quotation',
        items: 'Tornillo × 100',
        total: '$25.00',
        clientPhone: '593991234',
      });
    });

    it('should execute notify_advisor tool', async () => {
      const executor = service.createExecutor(baseContext);
      const result = await executor.execute('notify_advisor', {
        summary: 'Necesita ayuda con instalación',
      });

      expect(result.content).toBe('Asesor notificado.');
      expect(result.vendorNotification).toEqual({
        type: 'handoff',
        summary: 'Necesita ayuda con instalación',
        clientPhone: '593991234',
      });
    });

    it('should return error for unknown tool', async () => {
      const executor = service.createExecutor(baseContext);
      const result = await executor.execute('unknown_tool', {});

      expect(result.content).toContain('not found');
    });
  });
});
