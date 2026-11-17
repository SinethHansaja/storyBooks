-- Optional: a few sample books so the shop isn't empty on day one.
-- Delete them from Admin → Books once you've added your own.
insert into public.books (slug,title,author,description,price,compare_at_price,age_min,age_max,category,tags,format,pages,stock,emoji,palette,featured) values
('the-moonlit-unicorn','The Moonlit Unicorn','Lila Starling','When the moon forgets to rise, a shy little unicorn must gather the courage to light up the night sky.',2450,2950,3,7,'Fairy Tales','{unicorn,magic}','Hardcover',32,25,'🦄',4,true),
('sleepy-bears-cloud-pillow','Sleepy Bear’s Cloud Pillow','Oliver Dewdrop','A soothing bedtime board book about a bear searching for the softest place to dream.',1850,null,0,4,'Bedtime Stories','{bedtime}','Board Book',20,25,'🐻',1,true),
('princess-pip-and-the-paper-dragon','Princess Pip and the Paper Dragon','Maya Rosewood','A brave princess, a paper dragon and a kingdom-sized adventure.',2750,null,5,9,'Adventure','{dragon,princess}','Hardcover',40,20,'🐉',0,true),
('hello-rainbow-garden','Hello, Rainbow Garden!','Ava Bloom','Learn colours with flowers, bugs and a very cheerful snail.',1450,null,1,4,'Early Learning','{colours,nature}','Board Book',16,30,'🌈',2,false),
('whispers-of-the-wishing-well','Whispers of the Wishing Well','Lila Starling','A first chapter book full of secret wishes and unexpected friends.',3250,null,8,12,'Fantasy','{chapter book,magic}','Hardcover',144,15,'🪄',7,true),
('the-owl-who-couldnt-hoot','The Owl Who Couldn’t Hoot','Oliver Dewdrop','A gentle story about finding your own voice.',2150,null,3,6,'Animals','{owls}','Paperback',32,18,'🦉',5,false)
on conflict (slug) do nothing;

insert into public.coupons (code,type,value,min_subtotal) values ('WELCOME10','percent',10,0) on conflict do nothing;
