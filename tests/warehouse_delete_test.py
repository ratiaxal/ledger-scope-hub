"""Authenticated regression: warehouse removal preserves existing orders and labels."""
import asyncio
import json
import os
import uuid
from pathlib import Path

from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        if os.environ.get("LOVABLE_BROWSER_AUTH_STATUS") == "injected":
            storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
            session_json = os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
            cookies = json.loads(os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON") or "[]")
        else:
            minted = json.loads(Path.home().joinpath(".cache/lovable-auth/session.json").read_text())
            storage_key = minted["storage_key"]
            session_json = json.dumps(minted["session"])
            cookies = minted.get("cookies") or []
        if cookies:
            await context.add_cookies([{**c, "url": "http://localhost:8080"} for c in cookies])
        await page.goto("http://localhost:8080")
        await page.evaluate("([k,v]) => localStorage.setItem(k,v)", [storage_key, session_json])
        await page.goto("http://localhost:8080/warehouse")

        # The app's own client keeps all requests scoped to its configured backend.
        async def query(table, method, payload=None, row_id=None):
            result = await page.evaluate("""async ({table,method,payload,row_id}) => {
              const {supabase} = await import('/src/integrations/supabase/client.ts');
              let q = supabase.from(table);
              if (method === 'insert') q = q.insert(payload);
              else if (method === 'delete') q = q.delete().eq('id',row_id);
              else q = q.select('*');
              if (method === 'select' && row_id) q = q.eq('id',row_id);
              const {data,error} = await q.select();
              return {data,error: error ? error.message : null};
            }""", {"table": table, "method": method, "payload": payload, "row_id": row_id})
            assert not result["error"], result["error"]
            return result["data"]

        warehouses = await query("warehouses", "select")
        assert warehouses, "A warehouse is required"
        warehouse_id = sorted(warehouses, key=lambda w: w["name"])[0]["id"]
        product_id, order_id, label_id = (str(uuid.uuid4()) for _ in range(3))
        name = "წაშლის შემოწმება " + product_id[:8]
        try:
            await query("products", "insert", {"id": product_id, "name": name, "current_stock": 3, "warehouse_id": warehouse_id})
            await query("labels", "insert", {"id": label_id, "name": name, "quantity": 7})
            await query("orders", "insert", {"id": order_id, "manual_company_name": name, "total_quantity": 2, "total_amount": 20})
            await query("order_lines", "insert", {"order_id": order_id, "product_id": product_id, "quantity": 2, "unit_price": 10, "line_total": 20})
            await query("order_gifts", "insert", {"order_id": order_id, "product_id": product_id, "quantity": 1})
            await page.reload()
            await page.get_by_placeholder("პროდუქტის ძებნა სახელით ან რიცხვით...").fill(name)
            delete = page.get_by_role("button", name=name + " — წაშლა", exact=True)
            await delete.wait_for()
            await delete.click()
            await delete.wait_for(state="detached")
            await page.reload()
            await page.get_by_placeholder("პროდუქტის ძებნა სახელით ან რიცხვით...").fill(name)
            assert await page.get_by_role("button", name=name + " — წაშლა", exact=True).count() == 0
            product = (await query("products", "select", row_id=product_id))[0]
            assert product["is_deleted"] is True
            assert (await query("orders", "select", row_id=order_id))[0]["total_amount"] == 20
            assert (await query("labels", "select", row_id=label_id))[0]["quantity"] == 7
            lines = await query("order_lines", "select")
            gifts = await query("order_gifts", "select")
            assert any(l["order_id"] == order_id and l["quantity"] == 2 for l in lines)
            assert any(g["order_id"] == order_id and g["quantity"] == 1 for g in gifts)
            Path("/tmp/browser/warehouse-delete").mkdir(parents=True, exist_ok=True)
            await page.screenshot(path="/tmp/browser/warehouse-delete/deleted.png")
            print("PASS: immediate removal persists; order total, lines, gifts and labels remain unchanged")
        finally:
            await query("orders", "delete", row_id=order_id)
            await query("products", "delete", row_id=product_id)
            await query("labels", "delete", row_id=label_id)
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())