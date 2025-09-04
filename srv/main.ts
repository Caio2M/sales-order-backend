import cds, { Service, Request } from '@sap/cds'
import { Customers, Product, Products, SalesOrderHeaders, SalesOrderItem, SalesOrderItems } from '@models/sales'

export default (service: Service) => {
     service.before('READ', '*', (request: Request) => {
        if (!request.user.is('read_only_user') && !request.user.is('admin')) {
            return request.reject(403, 'Não autorizado');
        }
    });
    service.before(['WRITE', 'DELETE'], '*', (request: Request) => {
        if (!request.user.is('admin')) {
            return request.reject(403, 'Não autorizada a escrita/deleção');
        }
    });
    service.after('READ', 'Customers', (results: Customers) => {
        results.forEach(customer => {
            if (!customer.email?.includes('@')) {
                customer.email = `${customer.email}@gmail.com`
            }
        })
    });

    service.before('CREATE', 'SalesOrderHeaders', async (request: Request) => {
        const params = request.data;
        const items:SalesOrderItem[] = params.items;
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

        const productsItems: SalesOrderItems = params.items.reduce((acc: SalesOrderItems, curr: SalesOrderItem) => {
            const existing = acc.find(item => item.product_id === curr.product_id);
            if (existing && existing?.quantity) {
                existing.quantity += curr.quantity || 0;
            } else {
                acc.push({ product_id: curr.product_id, quantity: curr.quantity });
            }
            return acc;
        }, []);

        for (const item of productsItems) {
            const dbProduct = products.find(product => product.id === item.product_id)
            if (!dbProduct) {
                return request.reject(404, `Product ${item.product_id} was not found`);
            }
            if (dbProduct.stock === 0) {
                return request.reject(400, `Product ${dbProduct.name}(${dbProduct.id}) has no stock`);
            }
            if (Number(dbProduct.stock) < Number(item.quantity)) {
                return request.reject(400, `Product ${dbProduct.name}(${dbProduct.id}) has insufficient stock. Requested: ${item.quantity}, Available: ${dbProduct.stock}.`);
            }
        }
        let totalAmount = 0;
        items.forEach(item => {
            totalAmount += (item.price as number) * (item.quantity as number);
        });
        if (totalAmount > 30000) {
            const discount = totalAmount * (10/100);
            totalAmount = totalAmount - discount
        }
        request.data.totalAmount = totalAmount;

    })

    service.after('CREATE', 'SalesOrderHeaders', async (results: SalesOrderHeaders) => {
        const headersAsArray = Array.isArray(results) ? results : [results] as SalesOrderHeaders;
        for (const header of headersAsArray) {
            const items = header.items as SalesOrderItems;
            const productsData = items.map(item => ({
                id: item.product_id as string,
                quantity: item.quantity as number
            }));
            const productsIds: string[] = productsData.map((productData) => productData.id);
            const productsQuery = SELECT.from('sales.Products').where({ id: productsIds });
            const products: Products = await cds.run(productsQuery);
            for (const productData of productsData) {
                const foundProduct = products.find(product => product.id === productData.id) as Product;
                foundProduct.stock = (foundProduct.stock as number) - productData.quantity;
                await cds.update('sales.Products').where({ id: foundProduct.id }).with({ stock: foundProduct.stock });
            }
        }
    })
}