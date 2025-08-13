import cds, { Service, Request } from '@sap/cds'
import { Customers } from '@models/sales'

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

    })
}