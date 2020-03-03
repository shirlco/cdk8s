import { JSONSchema4 } from "json-schema";
import { CodeMaker } from 'codemaker';
import { TypeGenerator } from "./codegen-types";

export interface GroupVersionKind {
  readonly group: string;
  readonly kind: string;
  readonly version: string
}

export const X_GROUP_VERSION_KIND = 'x-kubernetes-group-version-kind';

/**
 * Generates a construct for an API object defined by `def`.
 */
export function emitConstructForApiObject(code: CodeMaker, schema: JSONSchema4, def: JSONSchema4) {
  const objectNames = def[X_GROUP_VERSION_KIND] as GroupVersionKind[];
  if (!objectNames) {
    throw new Error(`object must include a ${X_GROUP_VERSION_KIND} key`);
  }

  const objectName = objectNames[0];
  if (!objectName) {
    throw new Error(`no object name`);
  }

  const groupPrefix = objectName.group ? `${objectName.group.toLocaleLowerCase().replace(/\./g, '-')}-` : '';
  const baseName = `${groupPrefix}${objectName.kind.toLocaleLowerCase()}-${objectName.version.toLocaleLowerCase()}`;

  if (!def.properties?.metadata) {
    console.error(`warning: no "metadata", skipping ${baseName}`);
    return;
  }

  const sourceFile = `${baseName}.ts`;
  const optionsStructName = `${objectName.kind}Options`;

  const typeGenerator = new TypeGenerator(schema);

  emitFile();

  function emitFile() {
    code.openFile(sourceFile);
    code.line(`// generated by cdk8s`);
    code.line();

    code.line(`import { ApiObject } from 'cdk8s';`);
    code.line(`import { Construct } from '@aws-cdk/core';`);
    code.line();
  
    emitOptionsStruct();

    code.line();

    emitConstruct();
    code.line();

    typeGenerator.generate(code);
  
    code.closeFile(sourceFile);
  }

  function emitOptionsStruct() {
    const copy: JSONSchema4 = { ...def };
    copy.properties = copy.properties || {};
    delete copy.properties!.apiVersion;
    delete copy.properties!.kind;
    delete copy.properties!.status;

    typeGenerator.addType(optionsStructName, copy);
  }
  
  function emitConstruct() {
    code.line('/**');
    code.line(` * ${ def?.description }`);
    code.line(` */`);
    code.openBlock(`export class ${objectName.kind} extends ApiObject`);

    emitInitializer();
  
    code.closeBlock();
  }

  function emitInitializer() {
    code.openBlock(`public constructor(scope: Construct, ns: string, options: ${optionsStructName})`);
    emitInitializerSuper();

    code.closeBlock();
  }

  function emitInitializerSuper() {
    const groupPrefix = objectName.group ? `${objectName.group}/` : '';
    code.open(`super(scope, ns, {`);
    code.line(`...options,`);
    code.line(`kind: '${objectName.kind}',`);
    code.line(`apiVersion: '${groupPrefix}${objectName.version}',`);
    code.close(`});`);    
  }
}

/**
 * Returns all schema definitions for API objects (objects that have the 'x-kubernetes-group-version-kind' annotation)
 */
export function findApiObjectDefinitions(schema: JSONSchema4) {
  const result = new Array<JSONSchema4>();
  for (const def of Object.values(schema.definitions || { })) {
    const kinds = def[X_GROUP_VERSION_KIND];
    if (!kinds) {
      continue;
    }

    result.push(def);
  }

  return result;
}