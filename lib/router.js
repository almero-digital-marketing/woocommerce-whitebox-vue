const Route = require('route-parser')

export default (app, { router, store }) => {
    router.beforeEach((to, from, next) => {
        store.dispatch('woo/take')
        let loading = []
        let wooItems = []
        for(const matched of to.matched) {
            const relativePath = decodeURI(to.path).replace(matched.meta.refId,'')
            const documentRoute = router.documentRoutes[matched.meta.refId]
            if (documentRoute) {
                const initialRoute = new Route(documentRoute.document.meta.route)
                const data = initialRoute.match(relativePath)
                loading.push(store.dispatch('woo/getEndpoint', { 
                    endpoint: documentRoute.document.meta.woo + '/', 
                    data 
                })
                .then(items => {
                    return store.dispatch('woo/take', items)
                }))
            } 
            if (matched.meta.woo) {
				if (Array.isArray(matched.meta.woo)) {
					wooItems.push(...matched.meta.woo)
				} else {
					wooItems.push(matched.meta.woo)
				}
            }
        }
        Promise.all(loading)
        .then(() => {
            if (wooItems.length) {
                return store.dispatch('woo/init', wooItems)
                .then(items => {
                    return store.dispatch('woo/take', items)
                })
            }
        })
        .then(() => next())
    })
    router.afterEach((to) => {
        let documents = []
        let wooItems = []
        for(const matched of to.matched) {
            if (matched.meta.wooData) {
                const wooData = matched.meta.wooData(store.getters.mikser.document)
                if (Array.isArray(wooData)) {
                    wooItems.push(...wooData)
                } else {
                    wooItems.push(wooData)
                }
			}
        }
        if (wooItems.length) {
            store.dispatch('woo/init', wooItems)
            .then(items => {
                return store.dispatch('woo/take', items)
            })
        }
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