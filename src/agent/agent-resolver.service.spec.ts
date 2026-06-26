import { AgentResolverService } from './agent-resolver.service';
import { ToolRegistryService } from './tool-registry.service';
import { PromptBuilderService } from './prompt-builder.service';
import { AgentContext } from './agent.interfaces';

describe('AgentResolverService', () => {
  let service: AgentResolverService;
  let toolRegistry: jest.Mocked<ToolRegistryService>;
  let promptBuilder: jest.Mocked<PromptBuilderService>;

  const mockTools = [{ name: 'search_products', description: 'test', parameters: {} }];
  const mockExecutor = { execute: jest.fn() };

  beforeEach(() => {
    toolRegistry = {
      resolveTools: jest.fn().mockReturnValue(mockTools),
      createExecutor: jest.fn().mockReturnValue(mockExecutor),
    } as any;

    promptBuilder = {
      build: jest.fn().mockReturnValue('system prompt'),
    } as any;

    service = new AgentResolverService(toolRegistry, promptBuilder);
  });

  const baseContext: AgentContext = {
    tenantId: 'tenant-1',
    contactPhone: '593991234',
    salesPhone: '593995678',
    isStaff: false,
    authorities: [],
    isLinkedContact: false,
  };

  it('should resolve EXTERNAL agent for non-staff', () => {
    const result = service.resolve(baseContext);

    expect(result.agentType).toBe('EXTERNAL');
    expect(toolRegistry.resolveTools).toHaveBeenCalledWith('EXTERNAL', baseContext);
    expect(promptBuilder.build).toHaveBeenCalledWith('EXTERNAL', '593995678', undefined);
  });

  it('should resolve INTERNAL agent for staff', () => {
    const ctx: AgentContext = { ...baseContext, isStaff: true, authorities: ['PRODUCT_READ'] };
    const result = service.resolve(ctx);

    expect(result.agentType).toBe('INTERNAL');
    expect(toolRegistry.resolveTools).toHaveBeenCalledWith('INTERNAL', ctx);
    expect(promptBuilder.build).toHaveBeenCalledWith('INTERNAL', '593995678', undefined);
  });

  it('should pass tenant custom prompt to builder', () => {
    const ctx: AgentContext = { ...baseContext, tenantCustomPrompt: 'Custom rules' };
    service.resolve(ctx);

    expect(promptBuilder.build).toHaveBeenCalledWith('EXTERNAL', '593995678', 'Custom rules');
  });

  it('should return tools and executor from registry', () => {
    const result = service.resolve(baseContext);

    expect(result.tools).toBe(mockTools);
    expect(result.toolExecutor).toBe(mockExecutor);
  });

  it('should return system prompt from builder', () => {
    const result = service.resolve(baseContext);

    expect(result.systemPrompt).toBe('system prompt');
  });
});
