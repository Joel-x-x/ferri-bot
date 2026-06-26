import { PromptBuilderService } from './prompt-builder.service';

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  beforeEach(() => {
    service = new PromptBuilderService();
  });

  it('should include base prompt for external agent', () => {
    const prompt = service.build('EXTERNAL', '593991234');

    expect(prompt).toContain('Eres FerriBot');
    expect(prompt).toContain('search_products');
    expect(prompt).toContain('send_quotation');
    expect(prompt).toContain('notify_advisor');
  });

  it('should include handoff rules with sales phone', () => {
    const prompt = service.build('EXTERNAL', '593991234');

    expect(prompt).toContain('593991234');
    expect(prompt).toContain('HANDOFF AL ASESOR');
  });

  it('should include internal rules for staff agent', () => {
    const prompt = service.build('INTERNAL', '593991234');

    expect(prompt).toContain('MODO SECRETARIO');
    expect(prompt).toContain('search_products_erp');
    expect(prompt).toContain('costo, precio mayorista y PVP');
  });

  it('should NOT include internal rules for external agent', () => {
    const prompt = service.build('EXTERNAL', '593991234');

    expect(prompt).not.toContain('MODO SECRETARIO');
    expect(prompt).not.toContain('search_products_erp');
  });

  it('should append tenant custom prompt when provided', () => {
    const customPrompt = 'Somos Ferretería López. Horario: 8am-6pm.';
    const prompt = service.build('EXTERNAL', '593991234', customPrompt);

    expect(prompt).toContain(customPrompt);
  });

  it('should not append tenant prompt when undefined', () => {
    const prompt = service.build('EXTERNAL', '593991234');
    const lines = prompt.split('\n\n');

    // Should end with handoff rules or base prompt, not "undefined"
    expect(prompt).not.toContain('undefined');
  });

  it('should handle null sales phone gracefully', () => {
    const prompt = service.build('EXTERNAL', null);

    expect(prompt).toContain('HANDOFF AL ASESOR');
    expect(prompt).not.toContain('null');
  });
});
