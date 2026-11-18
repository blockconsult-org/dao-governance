import { encodeShare, HASH_PREFIX } from '../../tools/dao-governance/codec'; export const shareHash = (model: any) => HASH_PREFIX + encodeShare(model, true);
