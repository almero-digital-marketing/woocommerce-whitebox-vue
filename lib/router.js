const Route = require('route-parser')

export default (app, { router, store, domainConfig }) => {

    router.beforeEach((to, from, next) => {
        const path = decodeURI(to.path)
        store.dispatch('woo/take', { path })
        
        let wooItems = []
        let documentRoute = domainConfig.documentRoutes[path]
        
		if (documentRoute && documentRoute.document.meta.woo) {
            if (typeof documentRoute.document.meta.woo == 'string') {
                wooItems.push({ endpoint: documentRoute.document.meta.woo })
            } else if (Array.isArray(documentRoute.document.meta.woo)) {
                wooItems.push(...documentRoute.document.meta.woo)
            } else {
                wooItems.push(documentRoute.document.meta.woo)
            }
		}
        
        for(const matched of to.matched) {
            const relativePath = path.replace(matched.meta.refId,'')
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
        .then(items => store.dispatch('woo/take', { items, path }))
        .then(() => next())
    })

    router.afterEach((to) => {   
        const path = decodeURI(to.path)    
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
            return store.dispatch('woo/take', { items, path })
        })
    })
}