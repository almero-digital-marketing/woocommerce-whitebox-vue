import { reactive } from 'vue'
import PureCache from 'pure-cache'

let storePool = new PureCache({ expiryCheckInterval: 1000 * 10 });
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
            settings: {}
        },
        mutations: {
            assignItems(state, items) {
                for (let item of items) {
                    if (!state.woomap[item.wooId] || new Date(state.woomap[item.wooId].date_modified) < new Date(item.date_modified)) {
                        item.loaded = true
                        state.woomap[item.wooId] = reactive(Object.freeze(item))
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
            setSettings(state, settings) {
                state.settings = Object.freeze(settings)
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
            products: state => state.hand.filter(item => item.wooType == 'product') ,
            product(state, getters) {
                return getters.products && getters.products[0]
            },
            categories: state => state.hand.filter(item => item.wooType == 'category') ,
            category(state, getters) {
                return getters.categories && getters.categories[0]
            },
            attributes: state => state.hand.filter(item => item.wooType == 'attribute') ,
            variations: state => id => state.hand.filter(item => item.wooType == `${id}/variation$`)
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
                        if (typeof document.meta.woo == 'string') {
                            items.push({ endpoint: document.meta.woo })
                        } else {
                            items.push(document.meta.woo)
                        }
                    }
                }
                return dispatch('init', { items })
            },
            async loadCart({ commit, state }) {
                if (!cartLoaded) {
                    cartLoaded = true
                    return new Promise(resolve => {
                        window.whitebox.init('store', (store) => {
                            store.service.storefronts.mikser.getCart(state.customer)
                            .then(cart => {
                                commit('setCart', cart)
                                resolve()
                            })
                        })
                    })
                }
            },
            async loadSettings({ commit }) {
                if (!cartLoaded) {
                    cartLoaded = true
                    return new Promise(resolve => {
                        window.whitebox.init('store', (store) => {
                            store.service.storefronts.mikser.getSettings({ cache: '1h' })
                            .then(settings => {
                                commit('setSettings', settings)
                                resolve()
                            })
                        })
                    })
                }
            },
            async init({ commit }, data) {
                let result = []
                let missingItems = data.items.filter(item => {
                    let key = JSON.stringify(item)
                    let items = storePool.get(key)
                    if (items) {
                        result.push(...items.value)
                        commit('assignItems', items.value)
                    }
                    return !items
                })
                return new Promise(resolve => {
                    window.whitebox.init('store', (store) => {
                        return store.service.storefronts.mikser.getItems({ items: missingItems }, { cache: '1h' })
                        .then(({ items }) => {
                            for(let i = 0; i < missingItems.length; i++) {
                                let missingItem = missingItems[i]
                                let key = JSON.stringify(missingItem)
                                storePool.put(key, items[i], 10 * 60 * 1000)
                                commit('assignItems', items[i])
                                result.push(...items[i])
                            }
                            resolve(result)
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