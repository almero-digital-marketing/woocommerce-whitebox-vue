import { mapGetters, mapState, mapActions } from 'vuex'

export default {
	computed: {
		...mapGetters('woo', [
			'woo', 
		]),
		...mapState('woo', [
			'hand',
			'cart'
		]),
		wooProduct() {
			return this.products.length == 1 && this.products[0]
		},
		wooProducts() {	
			return this.hand.filter(item =>  
				item._links.collection.find(
					collection => 
						new RegExp('/products$')
						.test(collection.href)
				)
			)
		},
		wooCategory() {
			return this.categories.length == 1 && this.categories[0]
		},
		wooCategories() {		
			return this.hand.filter(item =>  
				item._links.collection.find(
					collection => 
						new RegExp('/products/categories$')
						.test(collection.href)
				)
			)
		},
		wooAttributes() {
			return this.hand.filter(item =>  
				item._links.collection.find(
					collection => 
						new RegExp('/products/attributes$')
						.test(collection.href)
				)
			)
		}
	},
	methods: {
		...mapActions('woo', [
			'addToCart',
			'removeFromCart',
			'clearCart',
			'updateInCart'
		]),
		wooVariations(id) {
			return this.hand.filter(item =>  
				item._links.collection.find(
					collection => 
						new RegExp(`/products/${id}/variations$`)
						.test(collection.href)
				)
			)
		}
	}
}
