import { pluginBundle } from './build/plugin-bundle.ts'

// The id is the module-table id the browser registers this bundle under; it is
// also the Loader row name in cordis.patch.yml. Change one, change the other.
export default pluginBundle('@nakamuraia/dsh-plugin-speech')
