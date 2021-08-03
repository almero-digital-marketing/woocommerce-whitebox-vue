const Route = require('route-parser')

export default (app, { router, store, domainConfig }) => {

    router.beforeEach((to, from, next) => {
        store.dispatch('woo/take')
        
        let wooItems = []
        let documentRoute = domainConfig.documentRoutes[decodeURI(to.path)]
        
		if (documentRoute && documentRoute.document.meta.woo) {
            if (typeof documentRoute.document.meta.woo == 'string') {
                wooItems.push({ endpoint: documentRoute.document.meta.woo })
            } else {
                wooItems.push(documentRoute.document.meta.woo)
            }
		}
        
        for(const matched of to.matched) {
            const relativePath = decodeURI(to.path).replace(matched.meta.refId,'')
            documentRoute = domainConfig.documentRoutes[matched.meta.refId]
            
            if (documentRoute) {
                const initialRoute = new Route(documentRoute.document.meta.route)
                const item = initialRoute.match(relativePath)
                item.endpoint = documentRoute.document.meta.woo
                wooItems.push(item)

                if (typeof matched.meta.wooData == 'function') {
                    let matchedDocument = store.getters['mikser/href'](documentRoute.href, documentRoute.document.meta.lang)
                    const wooData = matched.meta.wooData(matchedDocument)
                    if (Array.isArray(wooData)) {
                        wooItems.push(...wooData)
                    } else {
                        wooItems.push(wooData)
                    }
                }
            } 
            if (matched.meta.woo) {
				if (Array.isArray(matched.meta.woo)) {
					wooItems.push(...matched.meta.woo)
				} else {
					wooItems.push(matched.meta.woo)
				}
            }
        }

        return Promise.resolve()
        .then(() => store.dispatch('woo/init', { items: wooItems }))
        .then(items => store.dispatch('woo/take', items))
        .then(() => next())
    })

    router.afterEach(() => {       
        let documents = []
        for(let lang in store.state.mikser.sitemap) {
            for(let href in store.state.mikser.sitemap[lang]) {
                let document = store.state.mikser.sitemap[lang][href]
                documents.push({
                    loaded: true,
                    meta: document.data.meta,
                    link: encodeURI(document.refId),
                })
            }
        }
        store.dispatch('woo/sync', documents)
        .then(items => {
            return store.dispatch('woo/take', items)
        })
    })
}