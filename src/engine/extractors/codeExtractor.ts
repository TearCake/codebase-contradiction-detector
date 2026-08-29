import { Project, ScriptTarget, SyntaxKind } from 'ts-morph';
import { NormalizedArtifact, ExtractedSymbol, ExtractedImport, ExtractedRoute, ExtractedEnvRef, ExtractedClaim } from '../../types/engine';

export function extractCodeArtifacts(artifact: NormalizedArtifact): void {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { target: ScriptTarget.ES2022 } });
  const sourceFile = project.createSourceFile(artifact.filePath, artifact.content);

  const symbols: ExtractedSymbol[] = [];
  const imports: ExtractedImport[] = [];
  const routes: ExtractedRoute[] = [];
  const envRefs: ExtractedEnvRef[] = [];
  const claims: ExtractedClaim[] = [];

  // 1. Extract Imports
  sourceFile.getImportDeclarations().forEach(imp => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    const importedSymbols: string[] = [];
    
    const defaultImport = imp.getDefaultImport();
    if (defaultImport) importedSymbols.push(defaultImport.getText());
    
    imp.getNamedImports().forEach(named => importedSymbols.push(named.getName()));

    imports.push({
      moduleSpecifier,
      importedSymbols,
      location: {
        startLine: imp.getStartLineNumber(),
        endLine: imp.getEndLineNumber(),
      },
    });
  });

  // 2. Extract Functions, Classes, and Exported Symbols
  sourceFile.getFunctions().forEach(fn => {
    const name = fn.getName() || 'anonymous';
    const isExported = fn.isExported();
    const jsDocs = fn.getJsDocs();
    const comment = jsDocs.length > 0 ? jsDocs.map(j => j.getCommentText() || '').join(' ') : undefined;

    symbols.push({
      name,
      kind: 'function',
      isExported,
      location: {
        startLine: fn.getStartLineNumber(),
        endLine: fn.getEndLineNumber(),
      },
      comment,
    });
  });

  sourceFile.getClasses().forEach(cls => {
    const name = cls.getName() || 'anonymous';
    const isExported = cls.isExported();

    symbols.push({
      name,
      kind: 'class',
      isExported,
      location: {
        startLine: cls.getStartLineNumber(),
        endLine: cls.getEndLineNumber(),
      },
    });
  });

  sourceFile.getVariableStatements().forEach(varStmt => {
    const isExported = varStmt.isExported();
    varStmt.getDeclarations().forEach(decl => {
      symbols.push({
        name: decl.getName(),
        kind: 'variable',
        isExported,
        location: {
          startLine: decl.getStartLineNumber(),
          endLine: decl.getEndLineNumber(),
        },
      });
    });
  });

  // 3. Express-style Route Definitions & process.env.* Extraction
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const text = node.getText();
      // Match Express route patterns: app.get, app.post, router.get, authRouter.post, etc.
      const routeMatch = text.match(/([a-zA-Z0-9_$]+)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/i);
      if (routeMatch) {
        const method = routeMatch[2].toUpperCase();
        const routePath = routeMatch[3];
        const startLine = node.getStartLineNumber();
        const endLine = node.getEndLineNumber();

        routes.push({
          method,
          path: routePath,
          location: { startLine, endLine },
          rawSnippet: node.getText().slice(0, 150),
        });

        // Claim representation
        claims.push({
          id: `claim-${artifact.filePath}-route-${startLine}`,
          artifactId: artifact.id,
          filePath: artifact.filePath,
          startLine,
          endLine,
          sourceType: artifact.artifactType,
          rawSnippet: node.getText().slice(0, 150),
          subject: `${method} ${routePath}`,
          assertion: `Route registered: ${method} ${routePath}`,
          symbolName: routePath,
          metadata: { method, routePath, kind: 'ROUTE_DEFINITION' },
        });
      }

      // Check for business logic grace period checks
      if (node.getKind() === SyntaxKind.IfStatement) {
        const ifText = node.getText();
        const thresholdMatch = ifText.match(/([a-zA-Z0-9_]+)\s*(>|<|>=|<=|==|===)\s*(\d+)/);
        if (thresholdMatch) {
          const paramName = thresholdMatch[1];
          const operator = thresholdMatch[2];
          const value = parseInt(thresholdMatch[3], 10);
          const startLine = node.getStartLineNumber();
          const endLine = node.getEndLineNumber();

          if (paramName.toLowerCase().includes('hour') || paramName.toLowerCase().includes('grace')) {
            claims.push({
              id: `claim-${artifact.filePath}-logic-${startLine}`,
              artifactId: artifact.id,
              filePath: artifact.filePath,
              startLine,
              endLine,
              sourceType: artifact.artifactType,
              rawSnippet: ifText.slice(0, 180),
              subject: 'cancellation_grace_period',
              assertion: `Cancellation threshold check: ${paramName} ${operator} ${value}`,
              symbolName: paramName,
              metadata: { paramName, operator, value, kind: 'BUSINESS_LOGIC_THRESHOLD' },
            });
          }
        }
      }

      // Zod Schema Extraction
      if (text.includes('z.object') || text.includes('z.string')) {
        const propertyMatches = text.matchAll(/([a-zA-Z0-9_]+)\s*:\s*z\.string\(\)\.nonempty/g);
        for (const match of propertyMatches) {
          const fieldName = match[1];
          const startLine = node.getStartLineNumber();
          const endLine = node.getEndLineNumber();

          claims.push({
            id: `claim-${artifact.filePath}-zod-${startLine}-${fieldName}`,
            artifactId: artifact.id,
            filePath: artifact.filePath,
            startLine,
            endLine,
            sourceType: artifact.artifactType,
            rawSnippet: node.getText().slice(0, 150),
            subject: `SCHEMA_FIELD:${fieldName}`,
            assertion: `Zod schema requires field ${fieldName}`,
            symbolName: fieldName,
            metadata: { fieldName, required: true, kind: 'ZOD_SCHEMA_REQUIREMENT' },
          });
        }
      }
    }

    // Process.env.* references
    if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
      const text = node.getText();
      if (text.startsWith('process.env.') && text !== 'process.env') {
        const envVarName = text.replace('process.env.', '').split('.')[0];
        const startLine = node.getStartLineNumber();
        const endLine = node.getEndLineNumber();

        envRefs.push({
          name: envVarName,
          location: { startLine, endLine },
          rawSnippet: node.getParent()?.getText().slice(0, 100) || text,
          isDefinition: false,
        });

        claims.push({
          id: `claim-${artifact.filePath}-env-${startLine}-${envVarName}`,
          artifactId: artifact.id,
          filePath: artifact.filePath,
          startLine,
          endLine,
          sourceType: artifact.artifactType,
          rawSnippet: node.getParent()?.getText().slice(0, 100) || text,
          subject: `ENV_VAR:${envVarName}`,
          assertion: `Code references env variable ${envVarName}`,
          symbolName: envVarName,
          metadata: { envVarName, kind: 'ENV_REFERENCE' },
        });
      }
    }
  });

  artifact.extracted.symbols = symbols;
  artifact.extracted.imports = imports;
  artifact.extracted.routes = routes;
  artifact.extracted.envRefs = envRefs;
  artifact.extracted.claims.push(...claims);
}
