export class ApiDocumentationService {
  private apiSpecs: Map<string, any> = new Map();

  registerApiSpec(serviceName: string, spec: any): void {
    this.apiSpecs.set(serviceName, spec);
  }

  getApiSpec(serviceName: string): any {
    return this.apiSpecs.get(serviceName);
  }

  getAllApiSpecs(): any {
    const specs = {};
    this.apiSpecs.forEach((spec, serviceName) => {
      specs[serviceName] = spec;
    });
    return specs;
  }

  generateAggregatedSpec(): any {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Smart Home Automation API',
        version: '1.0.0',
        description: 'Comprehensive API for intelligent home automation system'
      },
      servers: [
        {
          url: process.env.API_GATEWAY_URL || 'http://localhost:3000',
          description: 'API Gateway'
        }
      ],
      paths: this.aggregatePaths(),
      components: this.aggregateComponents()
    };
  }

  private aggregatePaths(): any {
    const paths = {};
    this.apiSpecs.forEach((spec, serviceName) => {
      if (spec.paths) {
        Object.keys(spec.paths).forEach(path => {
          const prefixedPath = `/${serviceName}${path}`;
          paths[prefixedPath] = spec.paths[path];
        });
      }
    });
    return paths;
  }

  private aggregateComponents(): any {
    const components = {
      schemas: {},
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    };

    this.apiSpecs.forEach((spec) => {
      if (spec.components && spec.components.schemas) {
        Object.assign(components.schemas, spec.components.schemas);
      }
    });

    return components;
  }

  generateMarkdownDocs(): string {
    let markdown = '# Smart Home Automation API Documentation\n\n';
    
    this.apiSpecs.forEach((spec, serviceName) => {
      markdown += `## ${serviceName.toUpperCase()} Service\n\n`;
      markdown += `${spec.info?.description || 'No description available'}\n\n`;
      
      if (spec.paths) {
        markdown += '### Endpoints\n\n';
        Object.keys(spec.paths).forEach(path => {
          const methods = spec.paths[path];
          Object.keys(methods).forEach(method => {
            const endpoint = methods[method];
            markdown += `#### ${method.toUpperCase()} ${path}\n\n`;
            markdown += `${endpoint.summary || endpoint.description || 'No description'}\n\n`;
          });
        });
      }
      markdown += '\n---\n\n';
    });

    return markdown;
  }
}
