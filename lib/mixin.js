import { mapGetters, mapState, mapActions } from 'vuex'

export default {
	computed: {
		...mapState('woo', {
			wooCart: 'cart',
			wooSettings: 'settings'
		}),
		...mapGetters('woo', {
			woo: 'woo',
			wooProduct: 'product',
			wooProducts: 'products',
			wooCategories: 'categories',
			wooCategory: 'category',
			wooAttributes: 'attributes',
			wooVariations: 'variations'
		}),
	},
	methods: {
		...mapActions('woo', [
			'reload',
			'login',
			'logout',
			'addToCart',
			'removeFromCart',
			'clearCart',
			'updateInCart',
			'addToWishlist',
			'removeFromWishlist',
			'deleteWishlist'
		]),
	}
}
