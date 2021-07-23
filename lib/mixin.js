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
		product() {
			return this.products.length == 1 && this.products[0]
		},
		products() {	
			return this.hand.filter(item =>  
				item._links.collection.find(
					collection => 
						new RegExp('/products$')
						.test(collection.href)
				)
			)
		},
		category() {
			return this.categories.length == 1 && this.categories[0]
		},
		categories() {		
			return this.hand.filter(item =>  
				item._links.collection.find(
					collection => 
						new RegExp('/products/categories$')
						.test(collection.href)
				)
			)
		},
		attributes() {
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
		variations(id) {
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
