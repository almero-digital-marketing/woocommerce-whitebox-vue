import useRouter from './router'
import useStore from './store'

export function wooApp(app, { store, router, domainConfig = {} }) {
	useRouter(app, { store, router, domainConfig })
	useStore(app, { store, router, domainConfig })
	
	domainConfig.projection = domainConfig.projection || {}
	Object.assign(domainConfig.projection, {
		'data.meta.woo': 1
	})

	return async () => {}
}
