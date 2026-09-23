import { existsSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * 私有内容仓库（luna-ore）与本站点仓库默认同级存放。
 * 公开 CI 只 checkout luna-site、外部贡献者也可能只克隆本站点，
 * 此时所有依赖 luna-ore 的测试自动跳过，不影响 Demo 流程。
 */
export const contentRepoDir = fileURLToPath(new URL('../../../luna-ore', import.meta.url));

export const hasContentRepo = existsSync(contentRepoDir);

export const testIfContentRepo = (name, fn) =>
  hasContentRepo
    ? test(name, fn)
    : test(name, { skip: '未检出同级 luna-ore 私有内容仓库（公开 CI / 单仓库场景），跳过' }, fn);
