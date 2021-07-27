import { reactive } from 'vue'

let storePool = {} 
let cartLoaded = false

export default (app, { router, store, domainConfig }) => {
    store.registerModule('woo', {
        namespaced: true,
        state: {
            customer: undefined,
            sitemap: {},
            woomap: {},
            cart: JSON.parse(localStorage.getItem('cart')),
            hand: [],
        },
        mutations: {
            assignItems(state, { endpoint, items }) {
                for (let item of items) {
                    let wooId = endpoint + '/' + item.id
                    if (!state.woomap[wooId] || new Date(state.woomap[wooId].date_modified) < new Date(item.date_modified)) {
                        item.loaded = true
                        state.woomap[wooId] = reactive(Object.freeze(item))
                    }
                }
            },
            assignDocuments(state, documents) {
				for (let document of documents) {
					let href = document.meta.href || document.refId
					let lang = document.meta.lang || ''
					if (!state.sitemap[lang]) state.sitemap[lang] = reactive({})
                    if (document.meta.woo) {
                        state.sitemap[lang][href] = document.meta.woo
                    }
				}
            },
            setCart(state, cart) {
                console.log('Cart:', cart)
                if (cart.items) {
                    localStorage.setItem('cart', JSON.stringify(cart))
                    state.cart = Object.freeze(cart)
                } else {
                    state.cart = null
                }
            },
            setHand(state, items) {
                if (items) {
                    for (let item of items) {
                        if (!state.hand.find(existing => JSON.stringify(existing._links) == JSON.stringify(item._links))) {
                            state.hand.push(Object.freeze(item))
                        }
                    }
                } else {
                    state.hand = []
                }
            }
        },
        getters: {
            woo: (state, getters, rootState, rootGetters) => {
				let route = domainConfig.documentRoutes[rootGetters['mikser/currentRefId']]
				if (!route) return {}
				let woo = getters.wref(route.href, route.lang)
				return woo || state.hand.length == 1 && state.hand[0] || {}
			},
            wref: (state) => (href, lang) => {
				if (typeof lang == 'boolean') {
					loaded = lang
					lang = undefined
				}
				lang =
					lang ||
					router.currentRoute.value && (domainConfig.documentRoutes[router.currentRoute.value.path] && domainConfig.documentRoutes[router.currentRoute.value.path].lang) ||
					document.documentElement.lang ||
					''
				let hreflang = state.sitemap[lang]
                if (hreflang) {
                    let wooId = hreflang[href]
                    return state.woomap[wooId]
                }
            },
            products(state) {
                return state.hand.filter(item =>  
                    item._links.collection.find(
                        collection => 
                            new RegExp('/products$')
                            .test(collection.href)
                    )
                )
            },
            product(state, getters) {
                return getters.products.length == 1 && getters.products[0]
            },
            categories(state) {
                return state.hand.filter(item =>  
                    item._links.collection.find(
                        collection => 
                            new RegExp('/categories$')
                            .test(collection.href)
                    )
                )
            },
            category(state, getters) {
                return getters.categories.length == 1 && getters.categories[0]
            },
            attributes(state) {
                return state.hand.filter(item =>  
                    item._links.collection.find(
                        collection => 
                            new RegExp('/attributes$')
                            .test(collection.href)
                    )
                )
            },
            variations: state => id => {
                return state.hand.filter(item =>  
                    item._links.collection.find(
                        collection => 
                            new RegExp(`/products/${id}/variations$`)
                            .test(collection.href)
                    )
                )
            }
        },
        actions: {
            take({ commit }, items) {
                commit('setHand', items)
            },
            sync({ commit, dispatch }, documents) {
                commit('assignDocuments', documents)
                let items = []
                for (let document of documents) {
                    if (document.loaded && document.meta.woo && !document.meta.route ) {
                        items.push(document.meta.woo)
                    }
                }
                return dispatch('init', items)
            },
            async init({ commit, state }, items) {
                const result = []
                return new Promise(resolve => {
                    window.whitebox.init('store', (store) => {
                        if (!cartLoaded) {
                            store.service.storefronts.mikser.getCart(state.customer)
                            .then(cart => commit('setCart', cart))
                            cartLoaded = true
                        }
                        if (!items.length) {
                            return resolve(result)
                        }
                        
                        let loading = []
                        let endpointIds = items
                        .filter(item => {
                            return typeof item == 'string' && 
                                !isNaN(item.split('/').pop()) && 
                                (!storePool[item] || Date.now() - storePool[JSON.stringify(item)] > 5 * 60 * 1000)
                        })
                        .reduce((r, v, i, a, k = v.split('/').slice(0,-1).join('/')) => ((r[k] || (r[k] = [])).push(v.split('/').pop()), r), {})
                        
                        for (let endpoint in endpointIds) {
                            if (endpoint) {
                                loading.push(
                                    store.service.storefronts.mikser
                                    .getEndpoint(endpoint + '/', {
                                        per_page: endpointIds[endpoint].length,
                                        include: endpointIds[endpoint]
                                    }, { cache: '1h' })
                                    .then(data => {
                                        result.push(...data)
                                        commit('assignItems', { endpoint, items: data })
                                    })
                                )
                            }
                        }
                        let endpointQueries = items
                        .filter(item => {
                            return (typeof item != 'string' || isNaN(item.split('/').pop())) &&
                                (!storePool[JSON.stringify(item)] || Date.now() - storePool[key] > 5 * 60 * 1000)
                        })

                        for (let endpoint of endpointQueries) {
                            if (typeof endpoint == 'string') {
                                endpoint = {
                                    endpoint
                                }
                            }
                            let query = {...endpoint}
                            query.page = query.page || 1
                            query.per_page = query.per_page || 10
                            delete query.endpoint

                            let loadPage = () => {
                                return store.service.storefronts.mikser
                                .getEndpoint(endpoint.endpoint + '/', query, { cache: '1h' })
                                .then(data => {
                                    result.push(...data)
                                    commit('assignItems', { ...endpoint, items: data })

                                    if (data.length == query.per_page) {
                                        query.page++
                                        return loadPage()
                                    }
                                })
                            }
                            loading.push(loadPage())
                        }
                        
                        return Promise.all(loading).then(() => resolve(result))
                    })
                })
            },
            async getEndpoint({ commit }, { endpoint, data }) {
                return new Promise(resolve => {
					window.whitebox.init('store', (store) => {
                        store.service.storefronts.mikser.getEndpoint(endpoint + '/', data, { cache: '1h'})
                        .then(data => {
                            commit('assignItems', { endpoint, items: data })
                            resolve(data)
                        })
                    })
                })
            },
            async addToCart({ commit, state }, data) {
                if (typeof data != 'object') {
                    data = {
                        id: data.toString(),
                        quantity: "1"
                    }
                }
                return new Promise(resolve => {
					window.whitebox.init('store', (store) => {
                        store.service.storefronts.mikser.addToCart(data, state.customer)
                        .then(cart => {
                            commit('setCart', cart)
                            resolve(cart)
                        })
                    })
                })
            },
            async removeFromCart({ commit, state }, { item }) {
                return new Promise(resolve => {
					window.whitebox.init('store', (store) => {
                        store.service.storefronts.mikser.removeFromCart({ 
                            item_key: item.toString() 
                        }, state.customer)
                        .then(cart => {
                            commit('setCart', cart)
                            resolve(cart)
                        })
                    })
                })
            },
            async updateInCart({ commit, state }, { item, quantity }) {
                return new Promise(resolve => {
					window.whitebox.init('store', (store) => {
                        store.service.storefronts.mikser.updateInCart({ 
                            item_key: item,
                            quantity,
                            return_cart: true
                        }, state.customer)
                        .then(cart => {
                            commit('setCart', cart)
                            resolve(cart)
                        })
                    })
                })
            },
            async clearCart({ commit, state }) {
                return new Promise(resolve => {
					window.whitebox.init('store', (store) => {
                        store.service.storefronts.mikser.clearCart(state.customer)
                        .then(() => {
                            commit('setCart')
                            resolve()
                        })
                    })
                })
            }
        }
    })
}