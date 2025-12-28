--- seledt post with particular tag
select * from webapp_booru_1_posts 
where
id in (
SELECT post_id
FROM webapp_booru_1_posts p
JOIN webapp_booru_1_post_tags pt ON p.id = pt.post_id
JOIN webapp_booru_1_tags t ON pt.tag_id = t.id
WHERE t.name = 'wallpapers'
);