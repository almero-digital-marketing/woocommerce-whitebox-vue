import { reactive } from 'vue'
import PureCache from 'pure-cache'
import Cookies from 'js-cookie'

let storePool = new PureCache({ expiryCheckInterval: 1000 * 10 });
let cartLoaded = false
let wishlistLoaded = false
let settingsLoaded = false

function getOptions() {
    const options = {}
    const cookies = Cookies.get()
    for(let cookie in cookies) {
        if (cookie.indexOf('Woo') == 0) {
            const key = cookie.replace('Woo', '')
            const option = key.charAt(0).toLowerCase() + key.slice(1)
            options[option] = cookies[cookie]
        }
    }
    return options
}

export default (app, { router, store, domainConfig }) => {
    store.registerModule('woo', {
        namespaced: true,
        state: {
            options: getOptions(),
            sitemap: {},
            woomap: {},
            cart: JSON.parse(localStorage.getItem('WooCart')),
            wishlist: JSON.parse(localStorage.getItem('WooWishlist')),
            hand: {},
            settings: {}
        },
        mutations: {
            assignItems(state, items) {
                console.log('FUCK', items)
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
            removeWishlist(state, item) {
                if (state.wishlist) {
                    let itemIdx = state.wishlist.items.findIndex(o => o.id == item.id)
                    state.wishlist.splice(itemIdx)
                    localStorage.setItem('WooWishlist', JSON.stringify(wishlist))
                }
            },
            addWishlist(state, item) {
                if (state.wishlist) {
                    state.wishlist.push(item)
                    localStorage.setItem('WooWishlist', JSON.stringify(wishlist))
                }
            },
            setWishlist(state, wishlist) {
                console.log('Wishlist:', wishlist)
                if (wishlist) {
                    localStorage.setItem('WooWishlist', JSON.stringify(wishlist))
                    state.wishlist = wishlist
                } else {
                    state.wishlist = null
                    localStorage.removeItem('WooWishlist')
                }
            },
            setCart(state, cart) {
                console.log('Cart:', cart)
                if (cart) {
                    localStorage.setItem('WooCart', JSON.stringify(cart))
                    state.cart = Object.freeze(cart)
                } else {
                    state.cart = null
                    localStorage.removeItem('WooCart')
                }
            },
            setSettings(state, settings) {
                state.settings = Object.freeze(settings)
            },
            setHand(state, { items, path }) {
                if (decodeURI(router.currentRoute.value.path) == path) {
                    for(let history in state.hand) {
                        if (history != path) {
                            state.hand[history] = []
                        }
                    }
                }
                if (items) {
                    if (!state.hand[path]) state.hand[path] = []
                    for (let item of items) {
                        if (!state.hand[path].find(existing => JSON.stringify(existing._links) == JSON.stringify(item._links))) {
                            state.hand[path].push(Object.freeze(item))
                        }
                    }
                } else {
                    state.hand[path] = []
                }
            },
            setOptions(state, options) {
                if (options) {
                    for(let option in options) {
                        state.options[option] = options[option]
                        if (option != 'password') {
                            Cookies.set('Woo' + option.charAt(0).toUpperCase() + option.slice(1), options[option])
                        }
                    }
                } else {
                    state.options = {}
                    for(let cookie in Cookies.get()) {
                        if (cookie.indexOf('Woo') == 0) {
                            Cookies.remove(cookie)
                        }
                    }
                }
            },
        },
        getters: {
            woo: (state, getters, rootState, rootGetters) => {
				let route = domainConfig.documentRoutes[rootGetters['mikser/currentRefId']]
				if (!route) return {}
				let woo = getters.wref(route.href, route.lang)
				return woo || state.hand[router.currentRoute.value.path].length == 1 && state.hand[router.currentRoute.value.path][0] || {}
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
            products: state => {
                return state.hand[decodeURI(router.currentRoute.value.path)].filter(item => item.wooType == 'product') 
            },
            product(state, getters) {
                return getters.products && getters.products[0]
            },
            categories: state => state.hand[decodeURI(router.currentRoute.value.path)].filter(item => item.wooType == 'category') ,
            category(state, getters) {
                return getters.categories && getters.categories[0]
            },
            attributes: state => state.hand[decodeURI(router.currentRoute.value.path)].filter(item => item.wooType == 'attribute') ,
            variations: state => id => state.hand[decodeURI(router.currentRoute.value.path)].filter(item => item.wooType == `${id}/variation$`)
        },
        actions: {
            take({ commit }, { items, path = decodeURI(router.currentRoute.value.path) }) {
                commit('setHand', { items, path })
            },
            async sync({ commit, dispatch }, documents) {
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
                            store.service.storefronts.mikser.getCart(state.options)
                            .then(({ data, options }) => {
                                commit('setCart', data)
                                commit('setOptions', options)
                                resolve()
                            })
                        })
                    })
                }
            },
            async loadWishlist({ commit, state }) {
                if (!wishlistLoaded) {
                    wishlistLoaded = true
                    return new Promise(resolve => {
                        window.whitebox.init('store', (store) => {
                            store.service.storefronts.mikser.getWishlist(state.options)
                            .then(({ data, options }) => {
                                commit('setWishlist', data)
                                commit('setOptions', options)
                                resolve()
                            })
                        })
                    })
                }
            },
            async loadSettings({ commit, state }) {
                if (!settingsLoaded) {
                    settingsLoaded = true
                    return new Promise(resolve => {
                        window.whitebox.init('store', (store) => {
                            store.service.storefronts.mikser.getSettings({ ...state.options, cache: '1h' })
                            .then(({ data, options }) => {
                                commit('setSettings', data)
                                commit('setOptions', options)
                                resolve()
                            })
                        })
                    })
                }
            },
            async reload({ dispatch }) {
                const loading = []
                if (cartLoaded) {
                    cartLoaded = false
                    loading.push(dispatch('loadCart'))
                }
                if (settingsLoaded) {
                    settingsLoaded = false
                    loading.push(dispatch('loadSettings'))
                }
                if (wishlistLoaded) {
                    wishlistLoaded = false
                    loading.push(dispatch('loadWishlist'))
                }
                return Promise.all(loading)
            },
            async login({ commit, dispatch }, options) {
                commit('setOptions', options)
                return dispatch('reload')
            }, 
            async logout({ commit }) {
                commit('setOptions')
                return dispatch('reload')
            },
            async init({ commit, state }, data) {
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
                        return store.service.storefronts.mikser.getItems({ items: missingItems }, { ...state.options, cache: '1h' })
                        .then(({ data, options }) => {
                            console.log(data)
                            for(let i = 0; i < missingItems.length; i++) {
                                let missingItem = missingItems[i]
                                let key = JSON.stringify(missingItem)
                                storePool.put(key, data[i], 10 * 60 * 1000)
                                commit('assignItems', data[i])
                                result.push(...data[i])
                            }
                            commit('setOptions', options)
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
                        store.service.storefronts.mikser.addToCart(data, state.options)
                        .then(({ data, options }) => {
                            commit('setCart', data)
                            commit('setOptions', options)
                            resolve(data)
                        })
                    })
                })
            },
            async removeFromCart({ commit, state }, { item }) {
                return new Promise(resolve => {
					window.whitebox.init('store', (store) => {
                        store.service.storefronts.mikser.removeFromCart({ 
                            item_key: item.toString() 
                        }, state.options)
                        .then(({ data, options }) => {
                            commit('setCart', data)
                            commit('setOptions', options)
                            resolve(data)
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
                        }, state.options)
                        .then(({ data, options }) => {
                            commit('setCart', data)
                            commit('setOptions', options)
                            resolve(data)
                        })
                    })
                })
            },
            async clearCart({ commit, state }) {
                return new Promise(resolve => {
					window.whitebox.init('store', (store) => {
                        store.service.storefronts.mikser.clearCart(state.options)
                        .then(({ options }) => {
                            commit('setCart')
                            commit('setOptions', options)
                            resolve()
                        })
                    })
                })
            },
            async addToWishlist({ commit, state }, data) {
                if (typeof data != 'object') {
                    data = {
                        id: data.toString(),
                        quantity: "1"
                    }
                }
                return new Promise(resolve => {
					window.whitebox.init('store', (store) => {
                        store.service.storefronts.mikser.addToWishlist(data, state.options)
                        .then(({ data, options }) => {
                            commit('addWishlist', data)
                            commit('setOptions', options)
                            resolve(data)
                        })
                    })
                })
            },
            async removeFromWishlist({ commit, state }, data) {
                window.whitebox.init('store', (store) => {
                    store.service.storefronts.mikser.addToWishlist(data, state.options)
                    .then(({ options }) => {
                        commit('removeWishlist', data)
                        commit('setOptions', options)
                        resolve(data)
                    })
                })
            },
            async deleteWishlist({ commit, state }, data) {
                window.whitebox.init('store', (store) => {
                    store.service.storefronts.mikser.wishlistDelete(data, state.options)
                    .then(({ options }) => {
                        commit('setWishlist')
                        commit('setOptions', options)
                        resolve(data)
                    })
                })
            },
        }
    })
}