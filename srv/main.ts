import cds, { Service, Request } from '@sap/cds'
import { Customers, Products, SalesOrderItem, SalesOrderItems } from '@models/sales'

export default (service: Service) => {
    service.after('READ', 'Customers', (results: Customers) => {
        results.forEach(customer => {
            if (!customer.email?.includes('@')) {
                customer.email = `${customer.email}@gmail.com`
            }
        })
    });
    
    service.before('CREATE', 'SalesOrderHeaders', async (request: Request) => {
        const params = request.data;
        const items: SalesOrderItems = params.items;
        if (!params.customer_id) {
            return request.reject(400, 'Invalid customer')
        }
        if (!params.items?.length) {
            return request.reject(400, 'Invalid items')
        }
        const customerQuery = SELECT.one.from('sales.Customers').where({ id: params.customer_id })
        const customer = await cds.run(customerQuery)
        if (!customer) {
            return request.reject(404, 'Customer not found')
        }
        const productsIds: string[] = params.items.map((item: SalesOrderItem) => item.product_id);
        const productsQuery = SELECT.from('sales.Products').where({ id: productsIds });
        const products: Products = await cds.run(productsQuery);
        for (const item of items) {
            const dbProduct = products.find(product => product.id === item.product_id)
            if (!dbProduct) {
                return request.reject(404, `Product ${item.product_id} was not found`);
            }
            if (dbProduct.stock === 0) {
                return request.reject(400, `Product ${dbProduct.name}(${dbProduct.id}) has no stock`);
            }
        }
    })
}