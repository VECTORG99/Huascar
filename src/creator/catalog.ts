import { CatalogCategory, CatalogItem } from './domain.js';

export const CATALOG_VERSION = '1.0.0';

export const catalogCategories: CatalogCategory[] = [
  { id: 'language', label: 'Lenguajes y runtimes', description: 'Lenguaje principal y runtime del proyecto.', multiple: true },
  { id: 'frontend', label: 'Frontend web', description: 'Frameworks y meta-frameworks para interfaces web.', multiple: true },
  { id: 'backend', label: 'Backend y APIs', description: 'Frameworks para APIs, servicios y aplicaciones de servidor.', multiple: true },
  { id: 'mobile', label: 'Desarrollo móvil', description: 'Stacks nativos y multiplataforma.', multiple: true },
  { id: 'data-ai', label: 'Datos e IA', description: 'Procesamiento de datos, machine learning y agentes.', multiple: true },
  { id: 'database', label: 'Persistencia', description: 'Bases relacionales, documentales, caché, búsqueda y vectores.', multiple: true },
  { id: 'architecture', label: 'Arquitecturas', description: 'Estilos arquitectónicos y patrones de organización.', multiple: false },
  { id: 'testing', label: 'Pruebas y calidad', description: 'Herramientas para validación funcional, estática y de seguridad.', multiple: true },
  { id: 'cicd', label: 'CI/CD', description: 'Automatización de integración, entrega y promoción.', multiple: false },
  { id: 'infrastructure', label: 'Infraestructura como código', description: 'Definición reproducible de infraestructura.', multiple: true },
  { id: 'container', label: 'Contenedores y orquestación', description: 'Empaquetado y operación de workloads.', multiple: true },
  { id: 'cloud', label: 'Cloud y hosting', description: 'Proveedores y plataformas de ejecución.', multiple: true },
  { id: 'observability', label: 'Observabilidad', description: 'Logs, métricas, trazas y gestión de errores.', multiple: true },
  { id: 'security', label: 'Seguridad y supply chain', description: 'Secretos, análisis y controles de dependencias.', multiple: true },
  { id: 'repository', label: 'Código y colaboración', description: 'Repositorios, pull requests e incidencias.', multiple: false },
  { id: 'agent-platform', label: 'Plataformas de agente', description: 'Formatos de configuración que generará Huascar.', multiple: true },
  { id: 'knowledge', label: 'Conocimiento', description: 'Mecanismos para aportar contexto estable o recuperable.', multiple: true },
];

type ItemSpec = [id: string, label: string, description: string, tags?: string[], recommendedFor?: string[]];

function makeItems(category: string, specs: ItemSpec[]): CatalogItem[] {
  return specs.map(([id, label, description, tags = [], recommendedFor = []]) => ({
    id,
    category,
    label,
    description,
    tags,
    recommendedFor,
    environments: ['development', 'production', 'both'],
  }));
}

export const catalogItems: CatalogItem[] = [
  ...makeItems('language', [
    ['typescript', 'TypeScript', 'JavaScript tipado para frontend, backend y tooling.', ['node', 'web'], ['web', 'api', 'agent']],
    ['javascript', 'JavaScript', 'Lenguaje universal del ecosistema web y Node.js.', ['node', 'web']],
    ['python', 'Python', 'Automatización, APIs, datos, IA y scripting.', ['ai', 'data', 'api'], ['agent', 'data', 'automation']],
    ['java', 'Java', 'Servicios empresariales y plataformas de larga vida.', ['jvm', 'enterprise'], ['api', 'enterprise']],
    ['kotlin', 'Kotlin', 'JVM moderno, Android y servicios multiplataforma.', ['jvm', 'android']],
    ['csharp', 'C#/.NET', 'Aplicaciones empresariales, APIs, escritorio y cloud.', ['dotnet', 'enterprise']],
    ['go', 'Go', 'Servicios de red, plataformas cloud y herramientas DevOps.', ['cloud', 'systems'], ['microservices', 'devops']],
    ['rust', 'Rust', 'Sistemas seguros, alto rendimiento y WebAssembly.', ['systems', 'wasm']],
    ['php', 'PHP', 'Aplicaciones web y plataformas de contenido.', ['web']],
    ['ruby', 'Ruby', 'Aplicaciones web orientadas a productividad.', ['web']],
    ['swift', 'Swift', 'Aplicaciones Apple y servicios Swift.', ['ios', 'apple']],
    ['dart', 'Dart', 'Aplicaciones multiplataforma con Flutter.', ['mobile']],
    ['cpp', 'C/C++', 'Sistemas, motores y aplicaciones de alto rendimiento.', ['systems', 'embedded']],
    ['elixir', 'Elixir', 'Sistemas distribuidos y tolerantes a fallos sobre BEAM.', ['distributed', 'realtime']],
  ]),
  ...makeItems('frontend', [
    ['react', 'React', 'Biblioteca para interfaces por componentes.', ['spa'], ['web']],
    ['nextjs', 'Next.js', 'React full-stack con SSR, RSC y rutas de servidor.', ['react', 'ssr'], ['web', 'fullstack']],
    ['vue', 'Vue', 'Framework progresivo para interfaces web.', ['spa']],
    ['nuxt', 'Nuxt', 'Meta-framework Vue para SSR y aplicaciones full-stack.', ['vue', 'ssr']],
    ['angular', 'Angular', 'Framework integral para aplicaciones empresariales.', ['enterprise', 'spa']],
    ['svelte', 'Svelte', 'Framework compilado para interfaces reactivas.', ['spa']],
    ['sveltekit', 'SvelteKit', 'Aplicaciones full-stack basadas en Svelte.', ['svelte', 'ssr']],
    ['astro', 'Astro', 'Sitios orientados a contenido con islas interactivas.', ['content', 'ssg']],
  ]),
  ...makeItems('backend', [
    ['express', 'Express', 'Framework HTTP minimalista para Node.js.', ['node', 'api']],
    ['nestjs', 'NestJS', 'Backend Node modular con inyección de dependencias.', ['node', 'enterprise']],
    ['fastify', 'Fastify', 'Framework Node orientado a rendimiento y esquemas.', ['node', 'api']],
    ['fastapi', 'FastAPI', 'APIs Python tipadas y asíncronas.', ['python', 'api']],
    ['django', 'Django', 'Framework Python integral con ORM y administración.', ['python', 'web']],
    ['flask', 'Flask', 'Microframework Python flexible.', ['python', 'api']],
    ['spring-boot', 'Spring Boot', 'Servicios JVM empresariales.', ['java', 'enterprise']],
    ['quarkus', 'Quarkus', 'Java optimizado para contenedores y cloud native.', ['java', 'cloud']],
    ['aspnet-core', 'ASP.NET Core', 'APIs y aplicaciones .NET multiplataforma.', ['dotnet', 'api']],
    ['gin', 'Gin', 'Framework HTTP ligero para Go.', ['go', 'api']],
    ['laravel', 'Laravel', 'Framework PHP productivo y completo.', ['php', 'web']],
    ['rails', 'Ruby on Rails', 'Framework web convention-over-configuration.', ['ruby', 'web']],
    ['phoenix', 'Phoenix', 'Aplicaciones web y tiempo real sobre Elixir.', ['elixir', 'realtime']],
  ]),
  ...makeItems('mobile', [
    ['react-native', 'React Native', 'Aplicaciones móviles con React y código compartido.', ['ios', 'android']],
    ['flutter', 'Flutter', 'UI multiplataforma compilada desde Dart.', ['ios', 'android']],
    ['android-native', 'Android nativo', 'Aplicaciones Android con Kotlin/Java.', ['android']],
    ['ios-native', 'iOS nativo', 'Aplicaciones Apple con Swift.', ['ios']],
    ['expo', 'Expo', 'Toolchain administrado para React Native.', ['react-native']],
  ]),
  ...makeItems('data-ai', [
    ['pandas', 'Pandas', 'Manipulación y análisis tabular en Python.', ['python', 'data']],
    ['spark', 'Apache Spark', 'Procesamiento distribuido de grandes volúmenes.', ['big-data']],
    ['pytorch', 'PyTorch', 'Deep learning e investigación aplicada.', ['ml']],
    ['tensorflow', 'TensorFlow', 'Entrenamiento y serving de modelos ML.', ['ml']],
    ['langchain', 'LangChain', 'Composición de aplicaciones y agentes con LLM.', ['llm', 'agent']],
    ['llamaindex', 'LlamaIndex', 'Ingesta, indexado y recuperación para LLM.', ['llm', 'rag']],
    ['vercel-ai-sdk', 'Vercel AI SDK', 'Integración de modelos y streaming en TypeScript.', ['llm', 'typescript']],
    ['ollama', 'Ollama', 'Ejecución local de modelos abiertos.', ['llm', 'local']],
  ]),
  ...makeItems('database', [
    ['postgresql', 'PostgreSQL', 'Base relacional general con extensiones avanzadas.', ['sql'], ['production']],
    ['mysql', 'MySQL/MariaDB', 'Base relacional ampliamente soportada.', ['sql']],
    ['sqlite', 'SQLite', 'Base embebida para desarrollo, edge y baja concurrencia.', ['sql', 'embedded'], ['development']],
    ['mongodb', 'MongoDB', 'Documentos JSON y esquemas flexibles.', ['nosql']],
    ['dynamodb', 'DynamoDB', 'Key-value administrado y serverless en AWS.', ['nosql', 'aws']],
    ['redis', 'Redis', 'Caché, estructuras en memoria y coordinación.', ['cache']],
    ['cassandra', 'Cassandra', 'Wide-column distribuido para alta escritura.', ['distributed']],
    ['elasticsearch', 'Elasticsearch/OpenSearch', 'Búsqueda, indexación y analítica de logs.', ['search']],
    ['pgvector', 'pgvector', 'Vectores dentro de PostgreSQL.', ['vector', 'rag']],
    ['pinecone', 'Pinecone', 'Base vectorial administrada.', ['vector', 'rag']],
    ['qdrant', 'Qdrant', 'Motor vectorial open-source y administrado.', ['vector', 'rag']],
  ]),
  ...makeItems('architecture', [
    ['modular-monolith', 'Monolito modular', 'Despliegue único con límites internos explícitos.', ['modular'], ['new-project', 'small-team']],
    ['monolith', 'Monolito tradicional', 'Aplicación única optimizada para simplicidad inicial.', ['simple']],
    ['microservices', 'Microservicios', 'Servicios desplegables de forma independiente.', ['distributed'], ['large-team', 'production']],
    ['serverless', 'Serverless', 'Funciones y servicios administrados con escalado por demanda.', ['cloud', 'event-driven']],
    ['event-driven', 'Event-driven', 'Componentes desacoplados por eventos y mensajería.', ['async', 'distributed']],
    ['hexagonal', 'Arquitectura hexagonal', 'Dominio aislado mediante puertos y adaptadores.', ['domain']],
    ['clean-architecture', 'Clean Architecture', 'Dependencias orientadas hacia reglas de negocio.', ['domain']],
    ['cqrs', 'CQRS', 'Modelos separados para comandos y consultas.', ['distributed', 'data']],
    ['data-pipeline', 'Pipeline de datos', 'Ingesta, transformación, calidad y publicación de datos.', ['data']],
  ]),
  ...makeItems('testing', [
    ['unit-tests', 'Pruebas unitarias', 'Validación rápida de unidades aisladas.', ['quality']],
    ['integration-tests', 'Pruebas de integración', 'Validación de límites y dependencias reales.', ['quality']],
    ['e2e-tests', 'Pruebas end-to-end', 'Validación de recorridos completos.', ['quality']],
    ['contract-tests', 'Contract testing', 'Compatibilidad entre servicios y consumidores.', ['microservices']],
    ['sast', 'SAST', 'Análisis estático de seguridad.', ['security']],
    ['dependency-scan', 'Escaneo de dependencias', 'Detección de vulnerabilidades de supply chain.', ['security']],
  ]),
  ...makeItems('cicd', [
    ['github-actions', 'GitHub Actions', 'Pipelines integrados con repositorios GitHub.', ['github']],
    ['gitlab-ci', 'GitLab CI/CD', 'Pipelines integrados con GitLab.', ['gitlab']],
    ['jenkins', 'Jenkins', 'Automatización extensible y autogestionada.', ['self-hosted']],
    ['circleci', 'CircleCI', 'CI/CD administrado y configurable.', ['managed']],
    ['azure-devops', 'Azure DevOps Pipelines', 'Pipelines y releases del ecosistema Azure.', ['azure']],
    ['argocd', 'Argo CD', 'Entrega GitOps para Kubernetes.', ['gitops', 'kubernetes']],
  ]),
  ...makeItems('infrastructure', [
    ['terraform', 'Terraform/OpenTofu', 'Infraestructura declarativa multi-cloud.', ['iac']],
    ['pulumi', 'Pulumi', 'Infraestructura como código con lenguajes generales.', ['iac']],
    ['cloudformation', 'AWS CloudFormation/CDK', 'Infraestructura nativa de AWS.', ['aws', 'iac']],
    ['bicep', 'Azure Bicep', 'Infraestructura declarativa de Azure.', ['azure', 'iac']],
    ['ansible', 'Ansible', 'Configuración y automatización de servidores.', ['configuration']],
  ]),
  ...makeItems('container', [
    ['docker', 'Docker', 'Empaquetado reproducible en contenedores.', ['container']],
    ['docker-compose', 'Docker Compose', 'Orquestación local y de servidor simple.', ['container']],
    ['kubernetes', 'Kubernetes', 'Orquestación de workloads distribuidos.', ['orchestration']],
    ['helm', 'Helm', 'Empaquetado y despliegue declarativo en Kubernetes.', ['kubernetes']],
    ['nomad', 'HashiCorp Nomad', 'Orquestación ligera de workloads.', ['orchestration']],
  ]),
  ...makeItems('cloud', [
    ['aws-ec2', 'AWS EC2', 'Máquinas virtuales administradas por el equipo.', ['aws', 'vm'], ['production']],
    ['aws-ecs', 'AWS ECS/Fargate', 'Contenedores administrados en AWS.', ['aws', 'container']],
    ['aws-eks', 'AWS EKS', 'Kubernetes administrado en AWS.', ['aws', 'kubernetes']],
    ['aws-lambda', 'AWS Lambda', 'Funciones serverless en AWS.', ['aws', 'serverless']],
    ['azure-vm', 'Azure Virtual Machines', 'Máquinas virtuales en Azure.', ['azure', 'vm']],
    ['azure-container-apps', 'Azure Container Apps', 'Contenedores serverless administrados.', ['azure', 'container']],
    ['azure-aks', 'Azure AKS', 'Kubernetes administrado en Azure.', ['azure', 'kubernetes']],
    ['gcp-compute', 'Google Compute Engine', 'Máquinas virtuales en GCP.', ['gcp', 'vm']],
    ['gcp-cloud-run', 'Google Cloud Run', 'Contenedores serverless administrados.', ['gcp', 'container']],
    ['gcp-gke', 'Google GKE', 'Kubernetes administrado en GCP.', ['gcp', 'kubernetes']],
    ['vercel', 'Vercel', 'Hosting y funciones orientadas a frontend/full-stack.', ['managed', 'web']],
    ['render', 'Render', 'Servicios, workers y bases administradas.', ['managed']],
    ['flyio', 'Fly.io', 'Aplicaciones distribuidas en máquinas ligeras.', ['managed']],
    ['vps', 'VPS/servidor propio', 'Servidor Linux administrado por el equipo.', ['vm', 'self-hosted']],
  ]),
  ...makeItems('observability', [
    ['opentelemetry', 'OpenTelemetry', 'Instrumentación estándar de métricas, logs y trazas.', ['telemetry']],
    ['prometheus-grafana', 'Prometheus + Grafana', 'Métricas y visualización open-source.', ['metrics']],
    ['cloudwatch', 'AWS CloudWatch', 'Observabilidad nativa de AWS.', ['aws']],
    ['datadog', 'Datadog', 'Observabilidad administrada full-stack.', ['managed']],
    ['sentry', 'Sentry', 'Errores, performance y releases.', ['errors']],
    ['elastic-observability', 'Elastic Observability', 'Logs, métricas, APM y búsqueda.', ['elastic']],
  ]),
  ...makeItems('security', [
    ['oidc', 'OIDC/OAuth 2.0', 'Identidad federada y autorización estándar.', ['identity']],
    ['secrets-manager', 'Gestor de secretos', 'Referencias de secretos fuera del código y configuración.', ['secrets']],
    ['least-privilege', 'Mínimo privilegio', 'Permisos acotados por tarea y entorno.', ['iam']],
    ['sbom', 'SBOM', 'Inventario verificable de componentes de software.', ['supply-chain']],
    ['container-scan', 'Escaneo de imágenes', 'Análisis de vulnerabilidades en contenedores.', ['container']],
    ['policy-as-code', 'Policy as Code', 'Políticas versionadas y verificables.', ['governance']],
  ]),
  ...makeItems('repository', [
    ['github', 'GitHub', 'Repositorios, issues, Actions y pull requests.', ['git']],
    ['gitlab', 'GitLab', 'Repositorios, CI/CD y merge requests.', ['git']],
    ['bitbucket', 'Bitbucket', 'Repositorios y pipelines Atlassian.', ['git']],
    ['azure-repos', 'Azure Repos', 'Repositorios del ecosistema Azure DevOps.', ['git']],
    ['local-repository', 'Repositorio local', 'Proyecto sin integración remota obligatoria.', ['local']],
  ]),
  ...makeItems('agent-platform', [
    ['huascar', 'Huascar', 'Configuración nativa para HuascarEngine.', ['agent']],
    ['kiro', 'Kiro', 'Steering, hooks y skills bajo `.kiro/`.', ['agent', 'ide']],
    ['portable', 'Portable', 'AGENTS.md, skills y documentación independiente.', ['agent']],
  ]),
  ...makeItems('knowledge', [
    ['repository-docs', 'Documentación del repositorio', 'README, arquitectura, ADR y convenciones versionadas.', ['static']],
    ['source-code', 'Código fuente', 'Contexto del código y estructura del proyecto.', ['static']],
    ['web-documentation', 'Documentación web', 'Documentación externa revisada y permitida.', ['web']],
    ['tickets', 'Issues y tickets', 'Trabajo vivo desde el sistema de seguimiento.', ['dynamic']],
    ['runbooks', 'Runbooks operacionales', 'Procedimientos de operación y respuesta.', ['operations']],
    ['rag-vector-store', 'RAG vectorial', 'Corpus indexado para recuperación semántica.', ['rag']],
  ]),
];

const itemIndex = new Map(catalogItems.map(item => [item.id, item]));
const categoryIndex = new Map(catalogCategories.map(category => [category.id, category]));

export function getCatalogItem(id: string): CatalogItem | undefined {
  return itemIndex.get(id);
}

export function isCatalogItemFor(id: string, categories: string[]): boolean {
  if (id.startsWith('custom:')) return /^custom:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
  const item = itemIndex.get(id);
  return !!item && categories.includes(item.category);
}

export function getCreatorCatalog(filters?: { category?: string; environment?: string; q?: string }) {
  let items = catalogItems;
  if (filters?.category && categoryIndex.has(filters.category)) {
    items = items.filter(item => item.category === filters.category);
  }
  if (filters?.environment === 'development' || filters?.environment === 'production' || filters?.environment === 'both') {
    items = items.filter(item => item.environments.includes(filters.environment as 'development' | 'production' | 'both'));
  }
  if (filters?.q) {
    const query = filters.q.toLowerCase().trim();
    items = items.filter(item => [item.id, item.label, item.description, ...item.tags].some(value => value.toLowerCase().includes(query)));
  }
  return {
    version: CATALOG_VERSION,
    categories: catalogCategories,
    items,
    customFormat: 'custom:<slug>',
  };
}
