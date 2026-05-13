<div class="file-sep">products.as</div>

```atscript
@meta.label 'Products'
@db.table 'products'
export interface ProductsTable {
  @meta.id
  id: number

  @meta.label 'Name'
  @db.index.fulltext 'search_idx'
  @ui.table.width '16em'
  name: string

  @meta.label 'Price'
  @db.amount.currency 'USD'
  @ui.table.width '8em'
  price: number.decimal

  @meta.label 'Status'
  status: 'active' | 'draft' | 'archived'

  @meta.label 'Updated'
  updatedAt: number.timestamp.updated
}
```

<div class="file-sep">App.vue</div>

```vue
<AsTableRoot url="/api/products" v-slot="{ state }">
  <AsTable />
</AsTableRoot>
```
