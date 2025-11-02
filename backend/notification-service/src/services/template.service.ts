interface NotificationTemplate {
  templateId: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'in-app';
  subject?: string;
  body: string;
  variables: string[];
  language: string;
  category: string;
  active: boolean;
}

interface TemplateVersion {
  versionId: string;
  templateId: string;
  version: number;
  content: string;
  createdAt: Date;
  createdBy: string;
}

export class TemplateService {
  private templates: Map<string, NotificationTemplate> = new Map();
  private versions: Map<string, TemplateVersion[]> = new Map();

  async createTemplate(template: NotificationTemplate): Promise<string> {
    this.templates.set(template.templateId, template);
    
    const version: TemplateVersion = {
      versionId: `${template.templateId}-v1`,
      templateId: template.templateId,
      version: 1,
      content: template.body,
      createdAt: new Date(),
      createdBy: 'system'
    };
    
    this.versions.set(template.templateId, [version]);
    return template.templateId;
  }

  async updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<boolean> {
    const template = this.templates.get(templateId);
    if (!template) return false;

    Object.assign(template, updates);
    
    const versions = this.versions.get(templateId) || [];
    const newVersion: TemplateVersion = {
      versionId: `${templateId}-v${versions.length + 1}`,
      templateId,
      version: versions.length + 1,
      content: template.body,
      createdAt: new Date(),
      createdBy: 'system'
    };
    
    versions.push(newVersion);
    this.versions.set(templateId, versions);
    
    return true;
  }

  async renderTemplate(templateId: string, variables: Record<string, any>): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error('Template not found');

    let rendered = template.body;
    
    template.variables.forEach(varName => {
      const value = variables[varName] || '';
      rendered = rendered.replace(new RegExp(`{{${varName}}}`, 'g'), value);
    });

    return rendered;
  }

  async getTemplate(templateId: string): Promise<NotificationTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async listTemplates(type?: string, category?: string): Promise<NotificationTemplate[]> {
    let templates = Array.from(this.templates.values());
    
    if (type) {
      templates = templates.filter(t => t.type === type);
    }
    
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    return templates;
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    this.versions.delete(templateId);
    return this.templates.delete(templateId);
  }

  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return this.versions.get(templateId) || [];
  }

  async rollbackTemplate(templateId: string, version: number): Promise<boolean> {
    const template = this.templates.get(templateId);
    const versions = this.versions.get(templateId);
    
    if (!template || !versions) return false;

    const targetVersion = versions.find(v => v.version === version);
    if (!targetVersion) return false;

    template.body = targetVersion.content;
    return true;
  }
}

export const templateService = new TemplateService();
