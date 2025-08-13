import { Customer, Customers } from '@models/sales'

const customer: Customer = {
    email: "teste@teste.com",
    firstName: "Caio",
    lastName: "Melo",
    id: "1234"
}

const customers: Customers = [customer]

function teste (value: string) {
    console.log(value)
}
teste('1234yarn ')