const Route = require('route-parser')

export default (app, { router, store, domainConfig }) => {

    router.beforeEach((to, from, next) => {
        store.dispatch('woo/take')
        let loading = []
        function load(woo, data) {
            if (!woo) return

            let action = {}
            if (typeof woo == 'string') {
                action = { 
                    endpoint: woo + '/', 
                    data 
                }
            } else {
                action = { 
                    endpoint: woo.endpoint + '/', 
                    data: {...woo}
                }
                delete action.data.endpoint
                Object.assign(action.data, data)
            }
            loading.push(store.dispatch('woo/getEndpoint', action)
            .then(items => {
                return store.dispatch('woo/take', items)
            }))
        }

        let documentRoute = domainConfig.documentRoutes[decodeURI(to.path)]
		if (documentRoute) {
			load(documentRoute.document.meta.woo)
		}

        let wooItems = []
        for(const matched of to.matched) {
            const relativePath = decodeURI(to.path).replace(matched.meta.refId,'')
            documentRoute = domainConfig.documentRoutes[matched.meta.refId]

            if (documentRoute) {
                const initialRoute = new Route(documentRoute.document.meta.route)
                const data = initialRoute.match(relativePath)
                load(documentRoute.document.meta.woo, data)
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
            if (typeof matched.meta.wooData == 'function') {
                const wooData = matched.meta.wooData(store.getters['mikser/document'])
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